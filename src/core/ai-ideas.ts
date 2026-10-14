// AI date ideas: what goes into the prompt and how the answer is checked.
// Pure – the server fetches the weather and calls Claude.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type IdeaSize } from "@/lib/domain";

export const AI_IDEA_COUNT = 3;

export const BUDGETS = ["free", "low", "medium", "any"] as const;
export type Budget = (typeof BUDGETS)[number];
export const BUDGET_LABEL: Record<Budget, string> = { free: "Gratis", low: "bis 20 €", medium: "bis 50 €", any: "Egal" };
const BUDGET_PROMPT: Record<Budget, string> = {
  free: "free of charge",
  low: "at most about 20 euros for both together",
  medium: "at most about 50 euros for both together",
  any: "any budget",
};

export const MOODS = ["cozy", "active", "romantic", "creative", "surprise"] as const;
export type Mood = (typeof MOODS)[number];
export const MOOD_LABEL: Record<Mood, string> = { cozy: "🛋️ Gemütlich", active: "🏃 Aktiv", romantic: "💞 Romantisch", creative: "🎨 Kreativ", surprise: "🎲 Überrasch mich" };
const MOOD_PROMPT: Record<Mood, string> = {
  cozy: "cozy and relaxed",
  active: "active, with some movement",
  romantic: "romantic",
  creative: "creative, making something together",
  surprise: "anything – surprise them with something unusual",
};

export const SETTINGS = ["indoor", "outdoor", "any"] as const;
export type SettingPref = (typeof SETTINGS)[number];
export const SETTING_LABEL: Record<SettingPref, string> = { indoor: "🏠 Drinnen", outdoor: "🌳 Draußen", any: "Egal" };

export type HourlyWeather = {
  time: string[]; // local "YYYY-MM-DDTHH:MM" (Open-Meteo with timezone=Europe/Berlin)
  temperature_2m: Array<number | null>;
  precipitation_probability: Array<number | null>;
  weather_code: Array<number | null>;
};

// WMO weather codes as Open-Meteo reports them.
function sky(code: number): string {
  if (code === 0) return "klar";
  if (code <= 3) return "wolkig";
  if (code <= 48) return "neblig";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Regen";
  if (code <= 77 || code === 85 || code === 86) return "Schnee";
  return "Gewitter";
}

/** "12–15 °C, Regen wahrscheinlich (bis 70 %), Regen" for the hours of the slot – or null without data. Shown in the UI and sent to Claude. */
export function summarizeWeather(hourly: HourlyWeather, start: Date, end: Date, zone = APP_TIMEZONE): string | null {
  const from = DateTime.fromJSDate(start, { zone }).startOf("hour");
  const to = DateTime.fromJSDate(end, { zone });
  const temps: number[] = [];
  const rain: number[] = [];
  const codes: number[] = [];
  hourly.time.forEach((t, i) => {
    const at = DateTime.fromISO(t, { zone });
    if (at < from || at >= to) return;
    if (hourly.temperature_2m[i] != null) temps.push(hourly.temperature_2m[i]!);
    if (hourly.precipitation_probability[i] != null) rain.push(hourly.precipitation_probability[i]!);
    if (hourly.weather_code[i] != null) codes.push(hourly.weather_code[i]!);
  });
  if (temps.length === 0) return null;
  const lo = Math.round(Math.min(...temps));
  const hi = Math.round(Math.max(...temps));
  const maxRain = rain.length ? Math.max(...rain) : 0;
  const worst = codes.length ? sky(Math.max(...codes)) : null;
  const rainText = maxRain >= 50 ? `Regen wahrscheinlich (bis ${maxRain} %)` : maxRain >= 20 ? `vielleicht Regen (${maxRain} %)` : "trocken";
  return [`${lo === hi ? lo : `${lo}–${hi}`} °C`, rainText, worst].filter(Boolean).join(", ");
}

export type IdeaContext = {
  now: Date;
  slot: { start: Date; end: Date } | null;
  weather: string | null;
  budget: Budget;
  mood: Mood;
  setting: SettingPref;
  /** Fixed size (on the plan page the slot decides). */
  size?: IdeaSize;
  /** Titles already on the wishlist – not to be suggested again. */
  wishlist: string[];
  /** Past dates with their average hearts (1–5), most recent first. */
  pastDates: Array<{ title: string; hearts: number | null }>;
  /** Date budget left this month in euros (if they set one). */
  budgetLeft?: number | null;
};

export function buildIdeaPrompt(ctx: IdeaContext, zone = APP_TIMEZONE): string {
  const today = DateTime.fromJSDate(ctx.now, { zone }).setLocale("de").toFormat("cccc, d. LLLL yyyy");
  const lines = [`Today is ${today}.`];
  if (ctx.slot) {
    const start = DateTime.fromJSDate(ctx.slot.start, { zone }).setLocale("de");
    const minutes = Math.round((ctx.slot.end.getTime() - ctx.slot.start.getTime()) / 60_000);
    lines.push(`Time for the date: ${start.toFormat("cccc, d. LLLL, HH:mm")}, about ${Math.round(minutes / 30) / 2} hours.`);
  } else {
    lines.push("No fixed time yet – ideas should work on a normal evening or weekend.");
  }
  lines.push(`Weather in Cologne then: ${ctx.weather ?? "unknown"}.`);
  if (ctx.size) lines.push(ctx.size === "small" ? "It should be a small date (up to about 3 hours)." : "It should be a big date (half a day or more).");
  lines.push(`Budget: ${BUDGET_PROMPT[ctx.budget]}.`);
  if (typeof ctx.budgetLeft === "number") {
    lines.push(ctx.budgetLeft <= 10 ? "Their monthly date budget is nearly used up – prefer free ideas." : `They have about ${ctx.budgetLeft} euros left for dates this month.`);
  }
  lines.push(`Mood: ${MOOD_PROMPT[ctx.mood]}.`);
  if (ctx.setting !== "any") lines.push(`They want to be ${ctx.setting === "indoor" ? "indoors" : "outdoors"}.`);
  if (ctx.wishlist.length) lines.push(`Already on their wishlist (do not suggest these again): ${ctx.wishlist.slice(0, 40).join("; ")}.`);
  const rated = ctx.pastDates.filter((d) => d.hearts !== null).slice(0, 15);
  if (rated.length) lines.push(`Past dates and how they liked them (1–5 hearts): ${rated.map((d) => `${d.title} (${d.hearts})`).join("; ")}.`);
  return lines.join("\n");
}

export const AI_SYSTEM_PROMPT = [
  "You suggest date ideas for a young couple (students) in Cologne, Germany.",
  `Suggest exactly ${AI_IDEA_COUNT} different, concrete ideas that fit the time, weather, budget and mood.`,
  "Prefer things that really exist in or near Cologne, but do not invent specific events, opening hours or prices – if unsure, describe the idea generally (e.g. \"ein Programmkino\").",
  "Learn from their past ratings: more of what they loved, less of what they rated low.",
  "Write in German, casual and warm (du-Form for both, e.g. \"ihr\"). title: max 60 characters. description: 1–2 sentences. why: one short sentence why it fits now.",
  "size: \"small\" for up to about 3 hours, \"large\" for half a day or more. cost_eur: rough total for both (0 if free). location: district or place in or near Cologne.",
].join("\n");

export type RawAiIdea = { title: string; description: string; why: string; size: string; cost_eur: number | null; location: string | null; setting: string };

export type AiIdea = { title: string; size: IdeaSize; note: string; costEur: number | null; location: string | null; setting: "indoor" | "outdoor"; why: string };

function clip(value: unknown, max: number): string {
  const s = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Checks Claude's answer: sane lengths and numbers, no duplicates of the wishlist. */
export function cleanAiIdeas(raw: RawAiIdea[], wishlist: string[], size?: IdeaSize): AiIdea[] {
  const taken = new Set(wishlist.map((t) => t.toLowerCase().trim()));
  const result: AiIdea[] = [];
  for (const item of raw) {
    const title = clip(item.title, 120);
    if (!title || taken.has(title.toLowerCase())) continue;
    taken.add(title.toLowerCase());
    const cost = typeof item.cost_eur === "number" && Number.isFinite(item.cost_eur) ? Math.min(10_000, Math.max(0, Math.round(item.cost_eur))) : null;
    result.push({
      title,
      size: size ?? (item.size === "large" ? "large" : "small"),
      note: clip(item.description, 600),
      why: clip(item.why, 200),
      costEur: cost,
      location: clip(item.location, 120) || null,
      setting: item.setting === "indoor" ? "indoor" : "outdoor",
    });
    if (result.length === AI_IDEA_COUNT) break;
  }
  return result;
}
