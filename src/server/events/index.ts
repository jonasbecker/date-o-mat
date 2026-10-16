// Event sources: the websites a couple follows, and what was found on them.
import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { cleanItems, eventSpan, fitsFreeTime, followUpLinks, htmlToText, jsonLdEvents, MAX_PAGE_TEXT, MAX_SOURCE_TEXT, pageLinks, sameSite, type CleanItem } from "@/core/events";
import { cleanPicked, MAX_PICKED_PAGES, MAX_SOURCE_PAGES, pageLabel } from "@/core/source-pages";
import { mergeRanges } from "@/core/ranges";
import { APP_TIMEZONE, type EventSourceKind } from "@/lib/domain";
import { parseSourceUrl } from "@/lib/url-safety";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { eventSourcePages, eventSources, events, ideas, type EventRow, type EventSource, type EventSourcePage } from "@/server/db/schema";
import { env } from "@/server/env";
import { queryFreeBusy } from "@/server/google/calendar-api";
import { getConnection } from "@/server/google/connection";
import { getCoupleSettings } from "@/server/settings";
import { EXTRACTION_MODEL, extractItems, pickSourcePages } from "./extract";
import { reserveAiRequest } from "@/server/anthropic";
import { fetchPage, FetchPageError, fetchPublic } from "./fetch-page";
import { feedToText, findFeedLink, guessFeedUrl, parseFeed } from "@/core/feeds";

export const MAX_SOURCES = 12;
/** How often the tick reads a source again (every second morning – events are shown 60 days ahead). */
const REFRESH_HOURS = 44;
/** The tick starts reading sources from this hour on (Berlin), so it happens early in the morning. */
const REFRESH_FROM_HOUR = 5;
/** A fetch that started longer ago than this is considered dead. */
const STALE_FETCH_MS = 5 * 60_000;
/** With this many JSON-LD events (over all pages read), Claude is not asked at all. */
const ENOUGH_STRUCTURED = 25;
/** Without sub-pages: how many pagination pages (page 2, 3) are read along with the start page. */
const FOLLOW_UP_PAGES = 2;

export const COLOGNE_SOURCES: Array<{ url: string; label: string; kind: EventSourceKind }> = [
  { url: "https://rausgegangen.de/cologne/", label: "rausgegangen", kind: "calendar" },
  { url: "https://www.koeln.de/veranstaltungen/", label: "koeln.de", kind: "calendar" },
  { url: "https://www.koelntourismus.de/", label: "KölnTourismus", kind: "calendar" },
  { url: "https://koeln.mitvergnuegen.com/", label: "Mit Vergnügen", kind: "tips" },
];

// --- Sources ------------------------------------------------------------------------------

export async function listSources(coupleId: string): Promise<EventSource[]> {
  return db.select().from(eventSources).where(eq(eventSources.coupleId, coupleId)).orderBy(asc(eventSources.createdAt));
}

export type AddSourceResult = { ok: true; id: string } | { ok: false; error: "invalid" | "duplicate" | "limit" };

export async function addSource(ctx: CoupleContext, input: { url: string; kind: EventSourceKind; label?: string | null }): Promise<AddSourceResult> {
  const url = parseSourceUrl(input.url, env().allowPrivateEventUrls);
  if (!url) return { ok: false, error: "invalid" };
  if ((await db.$count(eventSources, eq(eventSources.coupleId, ctx.coupleId))) >= MAX_SOURCES) return { ok: false, error: "limit" };
  const label = input.label?.trim().slice(0, 40) || url.hostname.replace(/^www\./, "");
  const [row] = await db
    .insert(eventSources)
    .values({ coupleId: ctx.coupleId, url: url.toString(), label, kind: input.kind, createdById: ctx.user.id })
    .onConflictDoNothing()
    .returning({ id: eventSources.id });
  return row ? { ok: true, id: row.id } : { ok: false, error: "duplicate" };
}

export async function removeSource(coupleId: string, sourceId: string): Promise<void> {
  await db.delete(eventSources).where(and(eq(eventSources.id, sourceId), eq(eventSources.coupleId, coupleId)));
}

// --- Sub-pages ------------------------------------------------------------------------------

export async function listSourcePages(sourceIds: string[]): Promise<EventSourcePage[]> {
  if (sourceIds.length === 0) return [];
  return db.select().from(eventSourcePages).where(inArray(eventSourcePages.sourceId, sourceIds)).orderBy(asc(eventSourcePages.createdAt));
}

export type AddPageResult = { ok: true } | { ok: false; error: "invalid" | "other_site" | "duplicate" | "limit" };

/** A sub-page added by hand – same website as the source. */
export async function addSourcePage(coupleId: string, sourceId: string, input: string): Promise<AddPageResult> {
  const [source] = await db.select().from(eventSources).where(and(eq(eventSources.id, sourceId), eq(eventSources.coupleId, coupleId))).limit(1);
  const url = parseSourceUrl(input, env().allowPrivateEventUrls);
  if (!source || !url) return { ok: false, error: "invalid" };
  if (!sameSite(url.toString(), source.url)) return { ok: false, error: "other_site" };
  if (url.toString() === source.url) return { ok: false, error: "duplicate" };
  if ((await db.$count(eventSourcePages, eq(eventSourcePages.sourceId, sourceId))) >= MAX_SOURCE_PAGES) return { ok: false, error: "limit" };
  const [row] = await db
    .insert(eventSourcePages)
    .values({ sourceId, url: url.toString(), label: pageLabel(url.toString()), addedBy: "user" })
    .onConflictDoNothing()
    .returning({ id: eventSourcePages.id });
  return row ? { ok: true } : { ok: false, error: "duplicate" };
}

export async function removeSourcePage(coupleId: string, pageId: string): Promise<void> {
  const owned = db.select({ id: eventSources.id }).from(eventSources).where(eq(eventSources.coupleId, coupleId));
  await db.delete(eventSourcePages).where(and(eq(eventSourcePages.id, pageId), inArray(eventSourcePages.sourceId, owned)));
}

/** Once per source: Claude picks the listing pages from the start page's links. Never fails the read. */
async function pickPages(source: EventSource, page: { html: string; url: string }, now: Date): Promise<void> {
  try {
    const links = pageLinks(page.html, page.url);
    if (links.length > 0 && env().ai) {
      const requestId = await reserveAiRequest({ coupleId: source.coupleId, kind: "events", model: EXTRACTION_MODEL, now });
      if (!requestId) return; // try again on the next read
      const picked = cleanPicked(await pickSourcePages({ requestId, url: page.url, kind: source.kind, links }), links, page.url, MAX_PICKED_PAGES);
      if (picked.length > 0) {
        await db
          .insert(eventSourcePages)
          .values(picked.map((p) => ({ sourceId: source.id, url: p.url, label: p.label, addedBy: "ai" as const })))
          .onConflictDoNothing();
      }
    }
    await db.update(eventSources).set({ pagesPickedAt: now }).where(eq(eventSources.id, source.id));
  } catch (error) {
    console.warn(`[events] picking sub-pages for ${source.id} failed: ${error instanceof Error ? error.message : error}`);
  }
}

// --- Reading a source ------------------------------------------------------------------------

/** Atomically marks the source as being fetched; false if another run is already on it. */
async function claim(sourceId: string, now: Date): Promise<EventSource | undefined> {
  const [row] = await db
    .update(eventSources)
    // lastFetchedAt right away: a run that gets killed still counts as an attempt (no retry storm).
    .set({ fetchStartedAt: now, lastFetchedAt: now })
    .where(
      and(
        eq(eventSources.id, sourceId),
        or(isNull(eventSources.fetchStartedAt), lt(eventSources.fetchStartedAt, new Date(now.getTime() - STALE_FETCH_MS))),
      ),
    )
    .returning();
  return row;
}

/**
 * The RSS/Atom feed of a site (linked in the page, or WordPress' /feed/) as
 * text for Claude – null if there is none or it says nothing.
 */
async function feedText(pageHtml: string | null, pageUrl: string): Promise<{ text: string; url: string } | null> {
  const candidates = [pageHtml ? findFeedLink(pageHtml, pageUrl) : null, guessFeedUrl(pageUrl)].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
  for (const url of candidates) {
    try {
      const feed = await fetchPublic(url, { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", types: /xml|rss|atom/i });
      const xml = new TextDecoder("utf-8", { fatal: false }).decode(feed.body);
      const text = feedToText(parseFeed(xml, feed.url), feed.url, MAX_SOURCE_TEXT - MAX_PAGE_TEXT);
      if (text.length >= 200) return { text, url: feed.url };
    } catch {
      // no feed there – try the next candidate
    }
  }
  return null;
}

/** Pages read in parallel; a page that fails is skipped (and reported for sub-pages). */
async function fetchAll(urls: string[]): Promise<Array<{ html: string; url: string } | Error>> {
  const results = await Promise.allSettled(urls.map((url) => fetchPage(url)));
  return results.map((r) => (r.status === "fulfilled" ? r.value : r.reason instanceof Error ? r.reason : new Error(String(r.reason))));
}

type PageStat = { id: string; status: "ok" | "empty" | "error"; count: number; error: string | null };

/** What reading a source found; "unchanged" when its text is the same as last time (no Claude call). */
type ReadResult = { items: CleanItem[]; contentHash: string | null; pageStats: PageStat[] } | { unchanged: true };

async function itemsFor(source: EventSource, now: Date, force: boolean): Promise<ReadResult> {
  // Some sites block automated page requests or render with JavaScript – their feed often still works.
  let page: { html: string; url: string } | null = null;
  let pageError: unknown = null;
  try {
    page = await fetchPage(source.url);
  } catch (error) {
    pageError = error;
  }
  const baseUrl = page?.url ?? source.url;
  const options = { sourceUrl: baseUrl, sourceKind: source.kind, now };
  if (page && !source.pagesPickedAt) await pickPages(source, page, now);
  const subPages = await listSourcePages([source.id]);

  // The start page, its page 2 (and 3 without sub-pages) and its sub-pages.
  const followUps = page ? followUpLinks(page.html, page.url, subPages.length > 0 ? 1 : FOLLOW_UP_PAGES).filter((u) => !subPages.some((sp) => sp.url === u)) : [];
  const [fetched, nextPages] = await Promise.all([fetchAll(subPages.map((p) => p.url)), fetchAll(followUps)]);
  const isPage = (f: { html: string; url: string } | Error): f is { html: string; url: string } => !(f instanceof Error) && f.url !== page?.url;
  const pages = page ? [page, ...nextPages.filter(isPage), ...fetched.filter(isPage)] : [];
  const pageStats: PageStat[] = subPages.map((sp, i) => {
    const f = fetched[i];
    return f instanceof Error
      ? { id: sp.id, status: "error", count: 0, error: (f instanceof FetchPageError ? f.reason : "Nicht erreichbar").slice(0, 200) }
      : { id: sp.id, status: "empty", count: 0, error: null };
  });
  // A sub-page by its own and by its final URL (after redirects).
  const statByUrl = new Map<string, PageStat>();
  subPages.forEach((sp, i) => {
    statByUrl.set(sp.url, pageStats[i]);
    const f = fetched[i];
    if (!(f instanceof Error)) statByUrl.set(f.url, pageStats[i]);
  });
  const statFor = (url: string) => statByUrl.get(url);

  const structuredByPage = pages.map((p) => cleanItems(jsonLdEvents(p.html, p.url), options));
  const structured = cleanItems(structuredByPage.flat().map(toRaw), options);
  pages.forEach((p, i) => {
    const stat = statFor(p.url);
    if (stat && structuredByPage[i].length) Object.assign(stat, { status: "ok", count: structuredByPage[i].length });
  });
  if (structured.length >= ENOUGH_STRUCTURED) return { items: structured, contentHash: null, pageStats };
  if (!env().ai) {
    if (structured.length > 0) return { items: structured, contentHash: null, pageStats };
    throw new FetchPageError("Claude ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)");
  }
  // The start page gets the most room, the others share the rest.
  const extraBudget = pages.length > 1 ? Math.min(MAX_PAGE_TEXT / 2, Math.floor((MAX_SOURCE_TEXT - MAX_PAGE_TEXT * 0.75) / (pages.length - 1))) : 0;
  const parts = pages
    .map((p, i) => ({ url: p.url, text: htmlToText(p.html, p.url, i === 0 ? (pages.length > 1 ? MAX_PAGE_TEXT * 0.75 : MAX_PAGE_TEXT) : extraBudget) }))
    .filter((p) => p.text.length >= 200);
  // Magazines: the feed has the full articles (each with all its tips), the start page only teasers.
  if (parts.length === 0 || source.kind === "tips") {
    const feed = await feedText(page?.html ?? null, baseUrl);
    if (feed) parts.unshift(feed);
  }
  if (parts.length === 0) {
    if (structured.length > 0) return { items: structured, contentHash: null, pageStats };
    if (pageError) throw pageError;
    throw new FetchPageError("Seite ist fast leer (lädt ihre Inhalte vermutlich per JavaScript, und einen Feed gibt es nicht)");
  }
  const text = parts
    .map((p, i) => `${i === 0 ? "" : "\n\n"}--- [${i + 1}] ${p.url} ---\n${p.text}`)
    .join("")
    .slice(0, MAX_SOURCE_TEXT);
  const contentHash = createHash("sha256").update(`${source.kind}\n${text}`).digest("hex");
  // Same text as last time → same entries; only "Jetzt lesen" asks Claude again.
  if (!force && contentHash === source.contentHash && source.lastStatus !== "error") return { unchanged: true };
  const requestId = await reserveAiRequest({ coupleId: source.coupleId, kind: "events", model: EXTRACTION_MODEL, now });
  if (!requestId) throw new FetchPageError("Tageslimit für die KI-Auswertung erreicht – morgen geht's weiter");
  const raw = await extractItems({ requestId, pageText: text, url: parts[0].url, kind: source.kind, now });
  // Entries per sub-page (Claude names the section each one came from).
  parts.forEach((part, i) => {
    const stat = statFor(part.url);
    if (!stat) return;
    const count = cleanItems(raw.filter((r) => r.page === i + 1), options).length;
    if (count > 0) Object.assign(stat, { status: "ok", count: stat.count + count });
  });
  const extracted = cleanItems(raw, options);
  // JSON-LD first: it is exact, Claude's entries only add what is missing.
  return { items: cleanItems([...structured, ...extracted].map(toRaw), options), contentHash, pageStats };
}

function toRaw(item: CleanItem) {
  return {
    kind: item.kind,
    title: item.title,
    starts_at: item.startsAt ? (item.allDay ? DateTime.fromJSDate(item.startsAt, { zone: APP_TIMEZONE }).toISODate() : item.startsAt.toISOString()) : null,
    ends_at: item.endsAt ? (item.allDay ? DateTime.fromJSDate(item.endsAt, { zone: APP_TIMEZONE }).toISODate() : item.endsAt.toISOString()) : null,
    venue: item.venue,
    price: item.priceText,
    url: item.url,
    summary: item.summary,
  };
}

/** "Jetzt lesen" is ignored if the source was read this recently. */
export const MANUAL_REFRESH_COOLDOWN_MS = 10 * 60_000;

/**
 * Reads one source now and replaces its events. Returns false if it was already running.
 * `force` (the "Jetzt lesen" button) asks Claude even if the page has not changed.
 */
export async function refreshSource(sourceId: string, now: Date, options: { force?: boolean } = {}): Promise<boolean> {
  const source = await claim(sourceId, now);
  if (!source) return false;
  const force = options.force ?? false;
  try {
    let result = await itemsFor(source, now, force);
    if ("unchanged" in result) {
      await db.update(eventSources).set({ fetchStartedAt: null, lastFetchedAt: now }).where(eq(eventSources.id, source.id));
      return true;
    }
    let kind = source.kind;
    // Added as a calendar but no dated events (a magazine like Mit Vergnügen)? Read it once more as a
    // tips page – with its feed – and keep it that way if that finds something.
    if (result.items.length === 0 && source.kind === "calendar" && env().ai) {
      const asTips = await itemsFor({ ...source, kind: "tips", pagesPickedAt: source.pagesPickedAt ?? now }, now, true).catch(() => null);
      if (asTips && "items" in asTips && asTips.items.length > 0) {
        result = asTips;
        kind = "tips";
      }
    }
    const { items, contentHash, pageStats } = result;
    await db.transaction(async (tx) => {
      for (const stat of pageStats) {
        await tx.update(eventSourcePages).set({ lastStatus: stat.status, lastCount: stat.count, lastError: stat.error }).where(eq(eventSourcePages.id, stat.id));
      }
      await tx.delete(events).where(eq(events.sourceId, source.id));
      if (items.length > 0) {
        await tx.insert(events).values(items.map((item) => ({ ...item, coupleId: source.coupleId, sourceId: source.id })));
      }
      await tx
        .update(eventSources)
        .set({ kind, contentHash, fetchStartedAt: null, lastFetchedAt: now, lastStatus: items.length ? "ok" : "empty", lastError: null, lastCount: items.length })
        .where(eq(eventSources.id, source.id));
    });
  } catch (error) {
    const message = error instanceof FetchPageError ? error.reason : "Auswertung fehlgeschlagen";
    console.warn(`[events] reading source ${source.id} failed: ${error instanceof Error ? error.message : error}`);
    await db
      .update(eventSources)
      .set({ fetchStartedAt: null, lastFetchedAt: now, lastStatus: "error", lastError: message.slice(0, 200) })
      .where(eq(eventSources.id, source.id));
  }
  return true;
}

/** Called by the tick: reads at most one source per couple that is due (once a day, from early morning). */
export async function refreshDueSource(coupleId: string, now: Date): Promise<void> {
  if (DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).hour < REFRESH_FROM_HOUR) return;
  const [due] = await db
    .select({ id: eventSources.id })
    .from(eventSources)
    .where(
      and(
        eq(eventSources.coupleId, coupleId),
        or(isNull(eventSources.lastFetchedAt), lt(eventSources.lastFetchedAt, new Date(now.getTime() - REFRESH_HOURS * 3_600_000))),
      ),
    )
    .orderBy(sql`${eventSources.lastFetchedAt} asc nulls first`)
    .limit(1);
  if (due) await refreshSource(due.id, now);
}

// --- Reading events ------------------------------------------------------------------------------

export type EventWithSource = EventRow & { sourceLabel: string };

async function eventsWhere(coupleId: string, kind: "event" | "tip"): Promise<EventWithSource[]> {
  const rows = await db
    .select({ event: events, sourceLabel: eventSources.label })
    .from(events)
    .innerJoin(eventSources, eq(events.sourceId, eventSources.id))
    .where(and(eq(events.coupleId, coupleId), eq(events.kind, kind)))
    .orderBy(asc(events.startsAt), asc(events.title));
  return rows.map((r) => ({ ...r.event, sourceLabel: r.sourceLabel }));
}

/** Dated events that are not over yet and start within `days`. */
export async function upcomingEvents(coupleId: string, now: Date, days = 21): Promise<EventWithSource[]> {
  const limit = now.getTime() + days * 86_400_000;
  return (await eventsWhere(coupleId, "event")).filter((e) => {
    if (!e.startsAt || e.startsAt.getTime() > limit) return false;
    const span = eventSpan(e);
    const end = span?.end ?? e.endsAt ?? DateTime.fromJSDate(e.startsAt, { zone: APP_TIMEZONE }).endOf("day").toJSDate();
    return end > now;
  });
}

export async function tipsList(coupleId: string): Promise<EventWithSource[]> {
  return eventsWhere(coupleId, "tip");
}

export async function getEvent(coupleId: string, eventId: string): Promise<EventRow | undefined> {
  const [row] = await db.select().from(events).where(and(eq(events.id, eventId), eq(events.coupleId, coupleId))).limit(1);
  return row;
}

/** Wishlist entries that came from an event source (by dedupe key), to mark them as "gemerkt". */
export async function savedRefs(coupleId: string): Promise<Set<string>> {
  const rows = await db
    .select({ ref: ideas.externalRef })
    .from(ideas)
    .where(and(eq(ideas.coupleId, coupleId), eq(ideas.source, "web"), isNull(ideas.archivedAt)));
  return new Set(rows.map((r) => r.ref).filter((r): r is string => r !== null));
}

/**
 * For each timed event: are both free (calendars + buffer)? One FreeBusy query
 * per person for the whole range. Null when the calendars cannot be read.
 */
export async function freeForEvents(ctx: CoupleContext, list: Array<Pick<EventRow, "id" | "startsAt" | "endsAt" | "allDay">>): Promise<Map<string, boolean> | null> {
  const spans = list.map((e) => ({ id: e.id, span: eventSpan(e) })).filter((x): x is { id: string; span: { start: Date; end: Date } } => x.span !== null);
  if (spans.length === 0) return new Map();
  const settings = await getCoupleSettings(ctx.coupleId);
  const buffer = settings.bufferMinutes * 60_000;
  const from = new Date(Math.min(...spans.map((s) => s.span.start.getTime())) - buffer);
  const to = new Date(Math.max(...spans.map((s) => s.span.end.getTime())) + buffer);
  try {
    const results = await Promise.all(
      [ctx.user, ctx.partner].map(async (person) => {
        const connection = await getConnection(person.id);
        if (!connection || connection.status !== "ok") throw new Error("calendar not connected");
        return queryFreeBusy(person.id, connection.busyCalendarIds ?? ["primary"], from, to);
      }),
    );
    const busy = mergeRanges(results.flatMap((r) => r.busy));
    return new Map(spans.map(({ id, span }) => [id, fitsFreeTime(span, busy, settings.bufferMinutes)]));
  } catch (error) {
    console.warn("[events] free-time check failed", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Removes events that are long over (tips stay until the next fetch replaces them). */
export async function deleteOldEvents(): Promise<void> {
  await db
    .delete(events)
    .where(and(eq(events.kind, "event"), lt(sql`coalesce(${events.endsAt}, ${events.startsAt})`, sql`now() - interval '1 day'`)));
}
