// Thin wrapper around the Google Calendar REST API (plain fetch, no SDK).
import "server-only";
import { connection } from "next/server";
import type { CalendarListEntry } from "@/core/calendars";
import type { TimeRange } from "@/core/ranges";
import { env } from "@/server/env";
import { CalendarNotConnectedError, getAccessToken, markNeedsReauth } from "./connection";

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Google Calendar API error ${status}: ${body.slice(0, 300)}`);
  }
}

async function send(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env().googleApiBaseUrl}/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Calls the API as `userId` and returns the raw response. Retries once with a
 * refreshed token on 401; flags the connection when access is really gone.
 */
async function calendarFetch(userId: string, path: string, init?: RequestInit): Promise<Response> {
  // Never talk to Google while Next.js prerenders/prefetches a page – only for real requests.
  await connection();
  let response = await send(path, await getAccessToken(userId), init);
  if (response.status === 401) {
    response = await send(path, await getAccessToken(userId, { forceRefresh: true }), init);
  }
  if (response.status === 401) {
    await markNeedsReauth(userId);
    throw new CalendarNotConnectedError(userId, "reauth");
  }
  if (response.status === 403) {
    const body = await response.clone().text();
    // A permission the person later removed in their Google account.
    if (body.includes("insufficient")) {
      await markNeedsReauth(userId);
      throw new CalendarNotConnectedError(userId, "reauth");
    }
  }
  return response;
}

/** Like calendarFetch, but expects success and parses JSON. */
export async function calendarRequest<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const response = await calendarFetch(userId, path, init);
  if (!response.ok) throw new GoogleApiError(response.status, await response.text());
  return (await response.json()) as T;
}

export async function listCalendars(userId: string): Promise<CalendarListEntry[]> {
  const result = await calendarRequest<{ items?: CalendarListEntry[] }>(
    userId,
    "/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=250",
  );
  return result.items ?? [];
}

export type FreeBusyResult = {
  busy: TimeRange[];
  /** Calendars Google could not read (e.g. removed, or no permission). */
  failedCalendarIds: string[];
};

type FreeBusyResponse = {
  calendars?: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: unknown[] }>;
};

/** Busy times only – Google never sends titles or details for this endpoint. */
export async function queryFreeBusy(userId: string, calendarIds: string[], from: Date, to: Date): Promise<FreeBusyResult> {
  const result = await calendarRequest<FreeBusyResponse>(userId, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      timeZone: "UTC",
      items: calendarIds.map((id) => ({ id })),
    }),
  });
  const busy: TimeRange[] = [];
  const failedCalendarIds: string[] = [];
  for (const [id, calendar] of Object.entries(result.calendars ?? {})) {
    if (calendar.errors?.length) failedCalendarIds.push(id);
    for (const period of calendar.busy ?? []) {
      busy.push({ start: Date.parse(period.start), end: Date.parse(period.end) });
    }
  }
  return { busy, failedCalendarIds };
}

// --- Events (the date invitation) ------------------------------------------------

export type GoogleEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  attendees?: Array<{ email: string; responseStatus?: "needsAction" | "declined" | "tentative" | "accepted" }>;
};

const EVENTS = "/calendars/primary/events";

/** Creates the event with our own id. Returns false if it already exists (a retry). */
export async function insertEvent(userId: string, eventId: string, body: object): Promise<boolean> {
  const response = await calendarFetch(userId, `${EVENTS}?sendUpdates=all`, {
    method: "POST",
    body: JSON.stringify({ id: eventId, ...body }),
  });
  if (response.status === 409) return false;
  if (!response.ok) throw new GoogleApiError(response.status, await response.text());
  return true;
}

export async function patchEvent(userId: string, eventId: string, body: object): Promise<GoogleEvent> {
  return calendarRequest<GoogleEvent>(userId, `${EVENTS}/${eventId}?sendUpdates=all`, {
    method: "PATCH",
    body: JSON.stringify({ ...body, status: "confirmed" }),
  });
}

/** Deletes the event and notifies the guest. Already gone counts as success. */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  const response = await calendarFetch(userId, `${EVENTS}/${eventId}?sendUpdates=all`, { method: "DELETE" });
  if (response.ok || response.status === 404 || response.status === 410) return;
  throw new GoogleApiError(response.status, await response.text());
}

/** The event, or null if it does not exist (anymore). */
export async function getEvent(userId: string, eventId: string): Promise<GoogleEvent | null> {
  const response = await calendarFetch(userId, `${EVENTS}/${eventId}`);
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new GoogleApiError(response.status, await response.text());
  return (await response.json()) as GoogleEvent;
}
