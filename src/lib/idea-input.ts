import { isMotif } from "@/core/banners";
import { isCategory, type IdeaCategory } from "@/core/categories";
import { IDEA_SIZES, PLACE_SETTINGS, type IdeaSize, type PlaceSetting } from "./domain";

export const IDEA_LIMITS = { title: 120, note: 1000, url: 500, location: 120, maxCostEur: 10_000 } as const;

export type IdeaInput = {
  title: string;
  size: IdeaSize;
  note: string | null;
  url: string | null;
  costEur: number | null;
  location: string | null;
  /** Drinnen / draußen – empty means "egal". */
  setting: PlaceSetting | null;
  /** Empty = guessed from the words (core/categories.ts). */
  category: IdeaCategory | null;
  /** The banner picked in the editor (core/banners.ts) – left out when none was sent, so a save keeps the stored one. */
  motif?: string;
};

export type IdeaField = keyof IdeaInput;
export type IdeaFieldErrors = Partial<Record<IdeaField, string>>;
export type IdeaParseResult = { ok: true; data: IdeaInput } | { ok: false; errors: IdeaFieldErrors };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value: unknown): string | null {
  return text(value) || null;
}

/** "example.com/x" → "https://example.com/x". Only http(s) links are accepted (no javascript: etc.). */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** A typed euro amount as JS number text: "1.000" and "1.250,50" are German thousands, "12,50" a decimal comma. */
export function normalizeEuro(input: string): string {
  const cleaned = input.replace(/[€\s]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) return cleaned.replace(/\./g, "").replace(",", ".");
  return cleaned.replace(",", ".");
}

/** "15", "15 €", "12,50", "1.000" → whole euros. Empty → null. Invalid → NaN. */
export function parseCost(input: string): number | null {
  const cleaned = normalizeEuro(input);
  if (!cleaned) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned));
}

/** Validates the raw form values of the idea form. Messages are German (shown in the UI). */
export function parseIdeaInput(raw: Record<string, unknown>): IdeaParseResult {
  const errors: IdeaFieldErrors = {};

  const title = text(raw.title);
  if (!title) errors.title = "Wie heißt eure Idee?";
  else if (title.length > IDEA_LIMITS.title) errors.title = `Bitte kürzer als ${IDEA_LIMITS.title} Zeichen.`;

  const size = IDEA_SIZES.find((s) => s === raw.size);
  if (!size) errors.size = "Kurz oder lang?";

  const note = optional(raw.note);
  if (note && note.length > IDEA_LIMITS.note) errors.note = `Bitte kürzer als ${IDEA_LIMITS.note} Zeichen.`;

  const rawUrl = text(raw.url);
  const url = rawUrl ? normalizeUrl(rawUrl) : null;
  if (rawUrl && (!url || url.length > IDEA_LIMITS.url)) errors.url = "Das sieht nicht nach einem Link aus.";

  const costEur = parseCost(text(raw.costEur));
  if (costEur !== null && (Number.isNaN(costEur) || costEur > IDEA_LIMITS.maxCostEur)) {
    errors.costEur = "Bitte einen Betrag in Euro, z. B. 15.";
  }

  const location = optional(raw.location);
  if (location && location.length > IDEA_LIMITS.location) errors.location = `Bitte kürzer als ${IDEA_LIMITS.location} Zeichen.`;

  if (Object.keys(errors).length > 0 || !size) return { ok: false, errors };
  const setting = PLACE_SETTINGS.find((s) => s === raw.setting) ?? null;
  const category = isCategory(raw.category) ? raw.category : null;
  return { ok: true, data: { title, size, note, url, costEur, location, setting, category, ...(isMotif(raw.motif) ? { motif: raw.motif } : {}) } };
}

export function formatCost(costEur: number | null): string | null {
  if (costEur === null) return null;
  return costEur === 0 ? "kostenlos" : `~${costEur} €`;
}

/** "https://www.example.com/path" → "example.com" */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
