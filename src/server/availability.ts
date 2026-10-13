// Shared free time of the couple: FreeBusy of both calendars → slot finder.
// Busy times are only held in memory for this request, never stored.
import "server-only";
import { connection } from "next/server";
import type { TimeRange } from "@/core/ranges";
import { findSlots, type Slot } from "@/core/slots";
import type { CoupleContext } from "@/server/auth/dal";
import type { User } from "@/server/db/schema";
import { queryFreeBusy } from "@/server/google/calendar-api";
import { CalendarNotConnectedError, getConnection } from "@/server/google/connection";
import { getCoupleSettings, slotRulesFrom } from "@/server/settings";

export type CalendarState = "connected" | "missing" | "reauth";

export type PersonCalendar = { userId: string; name: string; isMe: boolean; state: CalendarState };

export async function calendarStates({ user, partner }: CoupleContext): Promise<PersonCalendar[]> {
  return Promise.all(
    [user, partner].map(async (person: User) => {
      const connection = await getConnection(person.id);
      const state: CalendarState = !connection ? "missing" : connection.status === "needs_reauth" ? "reauth" : "connected";
      return { userId: person.id, name: person.name, isMe: person.id === user.id, state };
    }),
  );
}

export type SlotSearch =
  | {
      status: "ok";
      small: Slot[];
      large: Slot[];
      until: Date;
      /** Number of calendars Google could not read (shown as a hint). */
      failedCalendars: number;
    }
  | { status: "not_connected"; people: PersonCalendar[] }
  | { status: "google_error" };

export async function searchSlots(ctx: CoupleContext, now: Date, until?: Date): Promise<SlotSearch> {
  // Live Google data: stop prefetch/prerender here, before any error handling below.
  await connection();
  const people = await calendarStates(ctx);
  if (people.some((p) => p.state !== "connected")) return { status: "not_connected", people };

  const settings = await getCoupleSettings(ctx.coupleId);
  const end = until ?? new Date(now.getTime() + settings.horizonDays * 24 * 60 * 60 * 1000);

  const results = await Promise.allSettled(
    [ctx.user, ctx.partner].map(async (person) => {
      const connection = await getConnection(person.id);
      return queryFreeBusy(person.id, connection?.busyCalendarIds ?? ["primary"], now, end);
    }),
  );

  const busy: TimeRange[] = [];
  let failedCalendars = 0;
  for (const result of results) {
    if (result.status === "rejected") {
      if (result.reason instanceof CalendarNotConnectedError) {
        return { status: "not_connected", people: await calendarStates(ctx) };
      }
      console.error("[slots] FreeBusy failed", result.reason);
      return { status: "google_error" };
    }
    busy.push(...result.value.busy);
    failedCalendars += result.value.failedCalendarIds.length;
  }

  const rules = slotRulesFrom(settings);
  return {
    status: "ok",
    small: findSlots({ now, until: end, busy, rules, size: "small" }),
    large: findSlots({ now, until: end, busy, rules, size: "large" }),
    until: end,
    failedCalendars,
  };
}
