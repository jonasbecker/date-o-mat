"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { eventSpan } from "@/core/events";
import { DATE_ERROR_MESSAGES } from "@/lib/date-errors";
import { EVENT_SOURCE_KINDS } from "@/lib/domain";
import { requireCouple, type CoupleContext } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { getDate, saveDate } from "@/server/dates";
import { db } from "@/server/db";
import { ideas } from "@/server/db/schema";
import { addSource, COLOGNE_SOURCES, getEvent, listSources, refreshSource, removeSource } from "@/server/events";
import { notifyPartner } from "@/server/notifications";
import { getCoupleSettings } from "@/server/settings";

export type SourceFormState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number };

const SOURCE_ERRORS = {
  invalid: "Das ist keine gültige https-Adresse.",
  duplicate: "Diese Seite folgt ihr schon.",
  limit: "Mehr als 12 Quellen gehen nicht.",
} as const;

async function nowFor(coupleId: string) {
  return coupleNow(await getCoupleSettings(coupleId));
}

export async function addSourceAction(_prev: SourceFormState, formData: FormData): Promise<SourceFormState> {
  const ctx = await requireCouple();
  const kind = z.enum(EVENT_SOURCE_KINDS).catch("calendar").parse(formData.get("kind"));
  const result = await addSource(ctx, { url: String(formData.get("url") ?? ""), kind, label: String(formData.get("label") ?? "") });
  if (!result.ok) return { status: "error", message: SOURCE_ERRORS[result.error] };
  const now = await nowFor(ctx.coupleId);
  after(() => refreshSource(result.id, now));
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function addCologneSourcesAction(): Promise<void> {
  const ctx = await requireCouple();
  const now = await nowFor(ctx.coupleId);
  const added: string[] = [];
  for (const source of COLOGNE_SOURCES) {
    const result = await addSource(ctx, source);
    if (result.ok) added.push(result.id);
  }
  after(async () => {
    for (const id of added) await refreshSource(id, now);
  });
  refresh();
}

export async function removeSourceAction(sourceId: string): Promise<void> {
  const { coupleId } = await requireCouple();
  const id = z.uuid().safeParse(sourceId);
  if (id.success) await removeSource(coupleId, id.data);
  refresh();
}

/** "Jetzt abrufen" – runs after the response; the list shows "wird gelesen …" meanwhile. */
export async function refreshSourceAction(sourceId: string): Promise<void> {
  const { coupleId } = await requireCouple();
  const id = z.uuid().safeParse(sourceId);
  const now = await nowFor(coupleId);
  if (id.success && (await listSources(coupleId)).some((s) => s.id === id.data)) {
    after(() => refreshSource(id.data, now));
  }
  refresh();
}

/** Puts an event or tip on the wishlist (once). */
export async function saveEventIdeaAction(eventId: string): Promise<{ ok: boolean }> {
  const { user, coupleId } = await requireCouple();
  const id = z.uuid().safeParse(eventId);
  const event = id.success ? await getEvent(coupleId, id.data) : undefined;
  if (!event) return { ok: false };
  const span = eventSpan(event);
  const long = span ? span.end.getTime() - span.start.getTime() > 4 * 3_600_000 : false;
  await db.insert(ideas).values({
    coupleId,
    title: event.title.slice(0, 120),
    size: long ? "large" : "small",
    note: [event.priceText, event.summary].filter(Boolean).join(" · ").slice(0, 1000) || null,
    url: event.url,
    location: event.venue?.slice(0, 120) ?? null,
    source: "web",
    externalRef: event.dedupeKey,
    createdById: user.id,
    updatedById: user.id,
  });
  refresh();
  return { ok: true };
}

async function tellPartner(ctx: CoupleContext, dateId: string) {
  const date = await getDate(ctx.coupleId, dateId);
  if (date) after(() => notifyPartner(ctx, "planned", date));
}

/** Plans the event as this round's date, at the event's time (Google invitation included). */
export async function planEventAction(eventId: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(eventId);
  const event = id.success ? await getEvent(ctx.coupleId, id.data) : undefined;
  const span = event ? eventSpan(event) : null;
  if (!event || !span) return { ok: false, message: "Dieses Event gibt es nicht mehr." };
  const now = await nowFor(ctx.coupleId);
  const size = span.end.getTime() - span.start.getTime() > 4 * 3_600_000 ? "large" : "small";
  const result = await saveDate(ctx, { start: span.start, end: span.end, size, ideaId: null, customTitle: null, customLocation: null, eventId: event.id }, now);
  if (result.ok) await tellPartner(ctx, result.dateId);
  refresh();
  return result.ok ? { ok: true } : { ok: false, message: DATE_ERROR_MESSAGES[result.error] };
}
