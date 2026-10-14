// Small helpers around a planned date: surprise dates, the preparation
// checklist, the route link and conversation cards. Pure.

import { DateTime } from "luxon";
import { APP_TIMEZONE } from "@/lib/domain";

// --- Surprise date ------------------------------------------------------------------------------------

type SurpriseFields = { surprise: boolean; organizerId: string; startsAt: Date };

/** A surprise is revealed on the day itself (00:00 Berlin). */
export function surpriseRevealAt(startsAt: Date, zone = APP_TIMEZONE): Date {
  return DateTime.fromJSDate(startsAt, { zone }).startOf("day").toJSDate();
}

/** Hidden for this viewer: a surprise, not planned by them, not revealed yet. `viewerId` null = Google Calendar (both see it). */
export function isSurpriseHidden(date: SurpriseFields, viewerId: string | null, now: Date): boolean {
  if (!date.surprise || viewerId === date.organizerId) return false;
  return now < surpriseRevealAt(date.startsAt);
}

export type MaskableDate = SurpriseFields & { title: string; location: string | null; note: string | null; url: string | null; surpriseHint: string | null };

/** What someone who must not know yet sees: time stays, the rest becomes the hint. */
export function maskSurprise<T extends MaskableDate>(date: T, viewerId: string | null, now: Date, organizerName: string): T {
  if (!isSurpriseHidden(date, viewerId, now)) return date;
  return { ...date, title: `🎁 Überraschung von ${organizerName}`, location: null, note: date.surpriseHint, url: null };
}

// --- Preparation checklist -----------------------------------------------------------------------------

const RULES: Array<{ match: RegExp; tasks: string[] }> = [
  { match: /restaurant|essen|dinner|brunch|frühstück|sushi|ramen|pizza|burger|tapas|bar\b|cocktail|wein/i, tasks: ["Tisch reservieren"] },
  { match: /kino|konzert|theater|oper|musical|show|festival|museum|ausstellung|comedy|lesung|fußballspiel|stadion|tickets?/i, tasks: ["Tickets kaufen"] },
  { match: /picknick/i, tasks: ["Decke & Snacks einpacken"] },
  { match: /ausflug|tagestrip|wandern|wanderung|fahrt nach|trip|bonn|düsseldorf|eifel|bergisch/i, tasks: ["Zugverbindung checken", "Wetter checken"] },
  { match: /kochen|kochabend|backen|grillen/i, tasks: ["Einkaufsliste schreiben"] },
  { match: /kurs|workshop|töpfer|tanz|kletter|boulder/i, tasks: ["Platz buchen"] },
  { match: /rhein|park|draußen|see|schwimm|freibad|fahrrad|rad/i, tasks: ["Wetter checken"] },
];

/** A few likely to-dos for this date (rule-based, no AI needed). */
export function suggestTasks(date: { title: string; note: string | null; location: string | null }, existing: string[] = []): string[] {
  const text = [date.title, date.note, date.location].filter(Boolean).join(" ");
  const have = new Set(existing.map((t) => t.toLowerCase()));
  const result: string[] = [];
  for (const rule of RULES) {
    if (!rule.match.test(text)) continue;
    for (const task of rule.tasks) if (!have.has(task.toLowerCase()) && !result.includes(task)) result.push(task);
  }
  return result.slice(0, 3);
}

/** "Noch offen fürs Date" goes out at 18:00 the day before (if the date is not earlier than that). */
export function prepReminderAt(startsAt: Date, zone = APP_TIMEZONE): Date {
  return DateTime.fromJSDate(startsAt, { zone }).minus({ days: 1 }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 }).toJSDate();
}

// --- Route --------------------------------------------------------------------------------------------------

/** Google Maps with public transport; the app adds "Köln" unless the place already names a city. */
export function routeUrl(destination: string, origin: string | null): string {
  const place = /köln|cologne|bonn|düsseldorf|aachen|\d{5}/i.test(destination) ? destination : `${destination}, Köln`;
  const params = new URLSearchParams({ api: "1", destination: place, travelmode: "transit" });
  if (origin?.trim()) params.set("origin", /köln|cologne|\d{5}/i.test(origin) ? origin.trim() : `${origin.trim()}, Köln`);
  return `https://www.google.com/maps/dir/?${params}`;
}

// --- Conversation cards ---------------------------------------------------------------------------------

export const CONVERSATION_CARDS = [
  "Was war dein schönster Moment diesen Monat?",
  "Wofür bist du gerade dankbar?",
  "Welches Date von uns würdest du sofort wiederholen?",
  "Was wolltest du schon immer mal ausprobieren?",
  "Wenn wir morgen spontan verreisen könnten – wohin?",
  "Was hast du als Kind am liebsten gemacht?",
  "Welcher Song erinnert dich an uns?",
  "Was bringt dich zuverlässig zum Lachen?",
  "Was ist ein kleines Ritual, das du an uns magst?",
  "Worauf freust du dich in den nächsten Wochen am meisten?",
  "Was hast du kürzlich Neues über dich gelernt?",
  "Welche drei Dinge würdest du auf eine einsame Insel mitnehmen?",
  "Was war dein erster Eindruck von mir?",
  "Wann hast du dich das letzte Mal so richtig mutig gefühlt?",
  "Was wäre dein perfekter Sonntag?",
  "Welche Gewohnheit würdest du gern ändern?",
  "Was ist dein liebstes Essen-Erlebnis aller Zeiten?",
  "Welches Buch, welcher Film oder welche Serie hat dich zuletzt bewegt?",
  "Wenn du ein Jahr frei hättest – was würdest du machen?",
  "Was magst du an Köln am meisten?",
  "Welche Kleinigkeit macht deinen Tag sofort besser?",
  "Was möchtest du dieses Jahr unbedingt noch erleben?",
  "Worüber hast du in letzter Zeit viel nachgedacht?",
  "Welche Eigenschaft bewunderst du an mir?",
  "Was war die beste Entscheidung, die du je getroffen hast?",
  "Wie sähe unser Traum-Wochenende aus?",
  "Was würdest du gern mal zusammen lernen?",
  "Welches Erlebnis mit Freund:innen hat dich geprägt?",
  "Wovor hattest du früher Angst und heute nicht mehr?",
  "Was ist dein liebster Ort, um abzuschalten?",
  "Was war das Lustigste, das uns zusammen passiert ist?",
  "Welche Tradition möchtest du mit mir anfangen?",
  "Was bedeutet für dich ein richtig guter Tag?",
  "Wenn du einen Tag lang jemand anderes sein könntest – wer?",
  "Welche drei Wörter beschreiben unser letztes Jahr?",
  "Was möchtest du öfter von mir hören?",
  "Was hat dich in letzter Zeit überrascht?",
  "Welches Abenteuer sollten wir als Nächstes planen?",
  "Was würde dein 10-jähriges Ich zu deinem Leben heute sagen?",
  "Was ist etwas, das du noch nie jemandem erzählt hast (und jetzt magst)?",
] as const;

/** The next card: random, but not one of the last ones. `random` is injectable for tests. */
export function nextCard(seen: number[], random: () => number = Math.random): number {
  const recent = new Set(seen.slice(-Math.min(seen.length, CONVERSATION_CARDS.length - 1)));
  const options = CONVERSATION_CARDS.map((_, i) => i).filter((i) => !recent.has(i));
  return options[Math.floor(random() * options.length)];
}

// --- Share key (iPhone shortcut) ------------------------------------------------------------------------------

/** "Bearer dom_xxx" or "dom_xxx" → the key, or null. */
export function shareKeyFromHeader(header: string | null): string | null {
  const key = (header ?? "").replace(/^Bearer\s+/i, "").trim();
  return /^dom_[A-Za-z0-9_-]{32,64}$/.test(key) ? key : null;
}
