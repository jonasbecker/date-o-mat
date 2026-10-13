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

/** Calls the API as `userId`; retries once with a refreshed token on 401. */
export async function calendarRequest<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
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
  if (!response.ok) {
    const body = await response.text();
    // A permission the person later removed in their Google account.
    if (response.status === 403 && body.includes("insufficient")) {
      await markNeedsReauth(userId);
      throw new CalendarNotConnectedError(userId, "reauth");
    }
    throw new GoogleApiError(response.status, body);
  }
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
