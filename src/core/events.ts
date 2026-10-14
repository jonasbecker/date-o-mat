// Event sources: turn a web page into a clean list of events/tips. Pure – the
// server fetches the page and asks Claude; everything here is testable without either.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type EventKind, type EventSourceKind } from "@/lib/domain";

/** Upper bound for the page text sent to Claude (~10k tokens). */
export const MAX_PAGE_TEXT = 40_000;
/** Events further ahead than this are ignored. */
export const EVENT_HORIZON_DAYS = 60;
/** A dated event without an end time is assumed to take this long. */
export const DEFAULT_EVENT_HOURS = 3;
const MAX_ITEMS = 60;

/** One entry as Claude (or the page's JSON-LD) describes it – everything still untrusted. */
export type RawItem = {
  kind?: string | null;
  title?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  venue?: string | null;
  price?: string | null;
  url?: string | null;
  summary?: string | null;
};

export type CleanItem = {
  kind: EventKind;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean;
  venue: string | null;
  priceText: string | null;
  url: string | null;
  summary: string | null;
  dedupeKey: string;
};

// --- HTML → text ----------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", ndash: "–", mdash: "—", hellip: "…", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code] ?? match;
  });
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Readable text of a page: scripts, styles, navigation and footer removed,
 * links kept as "[text](url)" so Claude can attach the right link to each event.
 */
export function htmlToText(html: string, baseUrl: string, maxLength = MAX_PAGE_TEXT): string {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head|nav|footer|iframe|form)\b[\s\S]*?<\/\1\s*>/gi, " ");
  s = s.replace(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, (_m, href: string, inner: string) => {
    const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const url = absoluteUrl(href, baseUrl);
    return label && url ? ` [${label}](${url}) ` : ` ${label} `;
  });
  s = s
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/article|\/section|\/time)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = decodeEntities(s)
    .replace(/[ \t\f\r\v]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
  return s.length > maxLength ? s.slice(0, maxLength) : s;
}

// --- JSON-LD (schema.org Event) ---------------------------------------------------------

function isEventType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && /Event$/.test(t));
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return decodeEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
  if (value && typeof value === "object" && "name" in value) return textOf((value as { name: unknown }).name);
  return null;
}

function priceOf(offers: unknown, free: unknown): string | null {
  if (free === true) return "Eintritt frei";
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || typeof offer !== "object") return null;
  const { price, lowPrice, priceCurrency } = offer as Record<string, unknown>;
  const value = price ?? lowPrice;
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (n === 0) return "Eintritt frei";
  const currency = priceCurrency === "EUR" || !priceCurrency ? "€" : String(priceCurrency);
  return Number.isFinite(n) ? `${lowPrice !== undefined && price === undefined ? "ab " : ""}${n.toLocaleString("de-DE")} ${currency}` : String(value);
}

/** Events the page declares itself (schema.org JSON-LD) – exact and free, no AI needed. */
export function jsonLdEvents(html: string, baseUrl: string): RawItem[] {
  const items: RawItem[] = [];
  const blocks = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 6 || items.length >= MAX_ITEMS) return;
    if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1));
    const obj = node as Record<string, unknown>;
    if (isEventType(obj["@type"])) {
      items.push({
        kind: "event",
        title: textOf(obj.name),
        starts_at: typeof obj.startDate === "string" ? obj.startDate : null,
        ends_at: typeof obj.endDate === "string" ? obj.endDate : null,
        venue: textOf(obj.location),
        price: priceOf(obj.offers, obj.isAccessibleForFree),
        url: typeof obj.url === "string" ? absoluteUrl(obj.url, baseUrl) : null,
        summary: textOf(obj.description),
      });
      return;
    }
    for (const key of ["@graph", "itemListElement", "item", "event", "events", "subEvent"]) {
      if (key in obj) visit(obj[key], depth + 1);
    }
  };
  for (const [, json] of blocks) {
    try {
      visit(JSON.parse(json.trim()), 0);
    } catch {
      // Broken JSON-LD is common – just skip it.
    }
  }
  return items;
}

// --- Cleaning -------------------------------------------------------------------------------

/** "2026-10-17" (all day), "2026-10-17T20:00" (Berlin wall clock) or with an explicit offset. */
export function parseEventTime(value: string | null | undefined, zone = APP_TIMEZONE): { date: Date; allDay: boolean } | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const day = DateTime.fromISO(trimmed, { zone });
    return day.isValid ? { date: day.toJSDate(), allDay: true } : null;
  }
  const parsed = DateTime.fromISO(trimmed, { zone, setZone: false });
  return parsed.isValid ? { date: parsed.toJSDate(), allDay: false } : null;
}

/** Same site: rausgegangen.de and www.rausgegangen.de match, other domains do not. */
export function sameSite(a: string, b: string): boolean {
  try {
    const site = (host: string) => host.toLowerCase().split(".").slice(-2).join(".");
    return site(new URL(a).hostname) === site(new URL(b).hostname);
  } catch {
    return false;
  }
}

function clip(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function dedupeKey(kind: EventKind, title: string, start: Date | null): string {
  const norm = title.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return `${kind}:${norm}@${start ? start.toISOString() : ""}`;
}

/**
 * Validates and normalizes what came out of a page: drops past and far-future
 * events, links to other sites, empty titles and duplicates.
 */
export function cleanItems(raw: RawItem[], options: { sourceUrl: string; sourceKind: EventSourceKind; now: Date; zone?: string }): CleanItem[] {
  const { sourceUrl, sourceKind, now, zone = APP_TIMEZONE } = options;
  const startOfToday = DateTime.fromJSDate(now, { zone }).startOf("day").toJSDate();
  const horizon = new Date(now.getTime() + EVENT_HORIZON_DAYS * 86_400_000);
  const seen = new Set<string>();
  const result: CleanItem[] = [];

  for (const item of raw) {
    if (result.length >= MAX_ITEMS) break;
    const title = clip(item.title, 150);
    if (!title) continue;
    const start = parseEventTime(item.starts_at, zone);
    const endParsed = parseEventTime(item.ends_at, zone);

    let kind: EventKind;
    if (start) kind = "event";
    else if (sourceKind === "tips" || item.kind === "tip") kind = "tip";
    else continue; // a calendar entry without a date is useless

    let end = endParsed?.date ?? null;
    if (start && end && end <= start.date) end = null;
    if (start) {
      const effectiveEnd = end ?? (start.allDay ? DateTime.fromJSDate(start.date, { zone }).endOf("day").toJSDate() : new Date(start.date.getTime() + DEFAULT_EVENT_HOURS * 3_600_000));
      if (effectiveEnd < now || start.date > horizon) continue;
      if (start.date < startOfToday && !end) continue;
    }

    const url = item.url ? absoluteUrl(item.url, sourceUrl) : null;
    const key = dedupeKey(kind, title, start?.date ?? null);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      kind,
      title,
      startsAt: start?.date ?? null,
      endsAt: end,
      allDay: start?.allDay ?? false,
      venue: clip(item.venue, 120),
      priceText: clip(item.price, 60),
      url: url && sameSite(url, sourceUrl) ? url : null,
      summary: clip(item.summary, 300),
      dedupeKey: key,
    });
  }
  return result;
}

/** The time an event blocks: its own span, or the default length; null for all-day events. */
export function eventSpan(event: { startsAt: Date | null; endsAt: Date | null; allDay: boolean }): { start: Date; end: Date } | null {
  if (!event.startsAt || event.allDay) return null;
  const end = event.endsAt && event.endsAt.getTime() - event.startsAt.getTime() <= 12 * 3_600_000
    ? event.endsAt
    : new Date(event.startsAt.getTime() + DEFAULT_EVENT_HOURS * 3_600_000);
  return { start: event.startsAt, end };
}

/** Both free during the event (plus buffer)? `busy` are the merged busy ranges of both calendars. */
export function fitsFreeTime(span: { start: Date; end: Date }, busy: Array<{ start: number; end: number }>, bufferMinutes: number): boolean {
  const from = span.start.getTime() - bufferMinutes * 60_000;
  const to = span.end.getTime() + bufferMinutes * 60_000;
  return !busy.some((range) => range.start < to && range.end > from);
}
