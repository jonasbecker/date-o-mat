// What a date looks like as a Google Calendar event. Pure, so it is unit-tested.

import { APP_TIMEZONE } from "@/lib/domain";

/**
 * Deterministic event id from the date's uuid. Google allows client-chosen ids
 * (base32hex: a–v, 0–9, 5–1024 chars), which makes "create" idempotent: a retry
 * after a timeout can never produce a second event.
 */
export function eventIdFor(dateId: string): string {
  return `dom${dateId.replace(/-/g, "").toLowerCase()}`;
}

export function isValidEventId(id: string): boolean {
  return /^[a-v0-9]{5,1024}$/.test(id);
}

export type EventSource = {
  id: string;
  title: string;
  location: string | null;
  note: string | null;
  url: string | null;
  costEur: number | null;
  startsAt: Date;
  endsAt: Date;
};

export type GoogleEventBody = {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: Array<{ email: string }>;
  colorId: string;
  reminders: { useDefault: boolean };
  extendedProperties: { private: { dateOMatId: string } };
};

export function buildEventBody(date: EventSource, partnerEmail: string, appUrl: string): GoogleEventBody {
  const lines = [
    date.note,
    date.url,
    date.costEur === null ? null : date.costEur === 0 ? "Kosten: kostenlos" : `Kosten: ca. ${date.costEur} €`,
  ].filter(Boolean);
  const footer = `Geplant mit dem Date-O-Mat 💞\n${appUrl}`;
  return {
    summary: `💞 Date: ${date.title}`,
    description: lines.length ? `${lines.join("\n")}\n\n${footer}` : footer,
    ...(date.location ? { location: date.location } : {}),
    start: { dateTime: date.startsAt.toISOString(), timeZone: APP_TIMEZONE },
    end: { dateTime: date.endsAt.toISOString(), timeZone: APP_TIMEZONE },
    attendees: [{ email: partnerEmail }],
    colorId: "4", // "Flamingo" – pink like the app
    reminders: { useDefault: true },
    extendedProperties: { private: { dateOMatId: date.id } },
  };
}
