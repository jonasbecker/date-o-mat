// "Läuft alles?": turns raw facts (last cron tick, calendar connections, push,
// event sources, Claude, photos) into a short, readable checklist. Pure.

import { agoLabel } from "@/lib/format";
import type { AiRequestKind } from "@/lib/domain";

/** The cron calls every 5 minutes; a few missed calls are normal. */
export const TICK_LATE_MINUTES = 15;
/** From here on reminders are noticeably late – worth a banner on the home screen. */
export const TICK_STALE_MINUTES = 60;

export type TickHealth = "ok" | "late" | "stale" | "never";

export function tickHealth(lastAt: Date | null, now: Date): TickHealth {
  if (!lastAt) return "never";
  const minutes = (now.getTime() - lastAt.getTime()) / 60_000;
  if (minutes <= TICK_LATE_MINUTES) return "ok";
  if (minutes <= TICK_STALE_MINUTES) return "late";
  return "stale";
}

export type StatusLevel = "ok" | "warn" | "off";
export type StatusRow = { key: string; label: string; level: StatusLevel; detail: string; href?: string };

export type StatusFacts = {
  now: Date;
  tick: { at: Date; errors: number } | null;
  cronConfigured: boolean;
  calendars: Array<{ name: string; me: boolean; status: "ok" | "needs_reauth" | "missing" }>;
  push: { configured: boolean; devices: Array<{ name: string; count: number }> };
  sources: { count: number; failing: number };
  ai: { configured: boolean; used: Record<AiRequestKind, number>; limits: Record<AiRequestKind, number> };
  photos: "blob" | "local" | null;
};

function tickRow(facts: StatusFacts): StatusRow {
  const label = "Automatik";
  if (!facts.cronConfigured) return { key: "tick", label, level: "warn", detail: "CRON_SECRET fehlt – ohne ihn gibt's keine Erinnerungen und keine neuen Runden im Hintergrund." };
  const health = tickHealth(facts.tick?.at ?? null, facts.now);
  if (health === "never" || !facts.tick) return { key: "tick", label, level: "warn", detail: "Noch nie gelaufen – ist cron-job.org eingerichtet? (siehe SETUP)" };
  const ago = agoLabel(facts.now, facts.tick.at);
  if (health !== "ok") return { key: "tick", label, level: "warn", detail: `Zuletzt ${ago} – sollte alle 5 Min. laufen. Erinnerungen kommen gerade nicht.` };
  if (facts.tick.errors > 0) return { key: "tick", label, level: "warn", detail: `Läuft (${ago}), aber mit Fehlern – siehe Vercel-Logs.` };
  return { key: "tick", label, level: "ok", detail: `Läuft – zuletzt ${ago}` };
}

function calendarRow(calendar: StatusFacts["calendars"][number]): StatusRow {
  const label = calendar.me ? "Dein Kalender" : `Kalender von ${calendar.name}`;
  const key = calendar.me ? "calendar-me" : "calendar-partner";
  if (calendar.status === "ok") return { key, label, level: "ok", detail: "Verbunden" };
  const what = calendar.status === "needs_reauth" ? "Verbindung verloren" : "Nicht verbunden";
  return calendar.me
    ? { key, label, level: "warn", detail: `${what} – bitte neu verbinden.`, href: "/settings#kalender" }
    : { key, label, level: "warn", detail: `${what} – ${calendar.name} muss ihn in den Einstellungen neu verbinden.` };
}

function pushRow(facts: StatusFacts): StatusRow {
  const label = "Push";
  if (!facts.push.configured) return { key: "push", label, level: "off", detail: "Nicht eingerichtet (VAPID-Schlüssel fehlen)" };
  const parts = facts.push.devices.map((d) => `${d.name}: ${d.count === 0 ? "aus" : d.count === 1 ? "1 Gerät" : `${d.count} Geräte`}`);
  const anyOff = facts.push.devices.some((d) => d.count === 0);
  return { key: "push", label, level: anyOff ? "warn" : "ok", detail: parts.join(" · ") };
}

function sourcesRow(facts: StatusFacts): StatusRow {
  const label = "Event-Quellen";
  const { count, failing } = facts.sources;
  if (count === 0) return { key: "sources", label, level: "off", detail: "Keine Webseiten hinterlegt", href: "/events" };
  if (failing > 0) return { key: "sources", label, level: "warn", detail: `${count} Seiten, ${failing} mit Fehler`, href: "/events" };
  return { key: "sources", label, level: "ok", detail: count === 1 ? "1 Seite wird gelesen" : `${count} Seiten werden gelesen` };
}

function aiRow(facts: StatusFacts): StatusRow {
  const label = "KI (Claude)";
  if (!facts.ai.configured) return { key: "ai", label, level: "off", detail: "Nicht eingerichtet (ANTHROPIC_API_KEY fehlt)" };
  const { used, limits } = facts.ai;
  const full = (Object.keys(limits) as AiRequestKind[]).filter((kind) => used[kind] >= limits[kind]);
  const detail = `Heute: Ideen ${used.ideas}/${limits.ideas} · Stapel ${used.deck}/${limits.deck} · Links ${used.links}/${limits.links} · Events ${used.events}/${limits.events}`;
  return { key: "ai", label, level: full.length ? "warn" : "ok", detail: full.length ? `${detail} – Limit erreicht, morgen geht's weiter` : detail };
}

function photosRow(facts: StatusFacts): StatusRow {
  const label = "Fotos";
  if (facts.photos === "blob") return { key: "photos", label, level: "ok", detail: "Vercel Blob (privat)" };
  if (facts.photos === "local") return { key: "photos", label, level: "ok", detail: "Lokaler Ordner (nur Entwicklung)" };
  return { key: "photos", label, level: "off", detail: "Nicht eingerichtet (BLOB_READ_WRITE_TOKEN fehlt)" };
}

export function statusRows(facts: StatusFacts): StatusRow[] {
  return [tickRow(facts), ...facts.calendars.map(calendarRow), pushRow(facts), sourcesRow(facts), aiRow(facts), photosRow(facts)];
}

/** "Alles läuft" unless something needs attention ("off" = feature not set up, which is fine). */
export function overallLevel(rows: StatusRow[]): "ok" | "warn" {
  return rows.some((row) => row.level === "warn") ? "warn" : "ok";
}
