// "Passt diese Woche" in a tile's view (core/idea-category.ts): per idea the earliest time both are free that fits it
// (its length, outdoor ideas by daylight) in the next days. One FreeBusy query per person (busy-cache.ts, shared
// with the swipe deck), at most one slot search per length × ranking that the ideas need. No calendars → all null.
import "server-only";
import { and, eq, isNotNull, max } from "drizzle-orm";
import { dayLabel, firstFree } from "@/core/card-when";
import { WEEK_DAYS, type IdeaTimes } from "@/core/idea-category";
import { slotModeFor, type SlotMode } from "@/core/slot-modes";
import { findSlots, type Slot } from "@/core/slots";
import { APP_TIMEZONE, type IdeaSize, type PlaceSetting } from "@/lib/domain";
import { DateTime } from "luxon";
import type { CoupleContext } from "@/server/auth/dal";
import { cachedBusy } from "@/server/busy-cache";
import { db } from "@/server/db";
import { datePlans, type CoupleSettings } from "@/server/db/schema";
import { queryFreeBusy } from "@/server/google/calendar-api";
import { getConnection } from "@/server/google/connection";
import { slotRulesFrom } from "@/server/settings";

type TimedIdea = { id: string; title: string; note: string | null; size: IdeaSize; setting: PlaceSetting | null };

export async function ideaTimes(ctx: CoupleContext, settings: CoupleSettings, now: Date, ideas: TimedIdea[]): Promise<IdeaTimes> {
  const none: IdeaTimes = { calendars: false, slots: Object.fromEntries(ideas.map((i) => [i.id, null])) };
  if (ideas.length === 0) return none;
  const until = new Date(now.getTime() + WEEK_DAYS * 86_400_000);
  try {
    const busy = await cachedBusy(ctx.coupleId, now, until, async () => {
      const results = await Promise.all(
        [ctx.user, ctx.partner].map(async (person) => {
          const connection = await getConnection(person.id);
          if (!connection || connection.status !== "ok") throw new CalendarMissing();
          return queryFreeBusy(person.id, connection.busyCalendarIds ?? ["primary"], now, until);
        }),
      );
      return results.flatMap((r) => r.busy);
    });
    const rules = slotRulesFrom(settings);
    const found = new Map<string, Slot | null>();
    const slotFor = (size: IdeaSize, mode: SlotMode): Slot | null => {
      const key = `${size}:${mode}`;
      if (!found.has(key)) {
        // Outdoor ideas: daylight counts here; the weather comes in when it is planned.
        const outdoor = mode === "standard" ? undefined : { weather: null, darknessOk: mode === "outdoorDark" };
        found.set(key, firstFree(findSlots({ now, until, busy, rules, size, limit: WEEK_DAYS + 1, outdoor }), size));
      }
      return found.get(key)!;
    };
    const slots = Object.fromEntries(
      ideas.map((idea) => {
        const slot = slotFor(idea.size, slotModeFor(idea));
        const time = slot && DateTime.fromJSDate(slot.start, { zone: APP_TIMEZONE }).toFormat("HH:mm");
        return [idea.id, slot ? { startIso: slot.start.toISOString(), label: `${dayLabel(slot.start)} · ab ${time}` } : null];
      }),
    );
    return { calendars: true, slots };
  } catch (error) {
    if (!(error instanceof CalendarMissing)) console.warn("[ideas] free-time check failed", error instanceof Error ? error.message : error);
    return none;
  }
}

class CalendarMissing extends Error {}

/** When a date with each idea was last planned (for the flower's tip: longest not planned first). */
export async function lastPlannedByIdea(coupleId: string): Promise<Map<string, Date>> {
  const rows = await db
    .select({ ideaId: datePlans.ideaId, at: max(datePlans.startsAt) })
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), isNotNull(datePlans.ideaId)))
    .groupBy(datePlans.ideaId);
  return new Map(rows.flatMap((r) => (r.ideaId && r.at ? [[r.ideaId, r.at] as const] : [])));
}
