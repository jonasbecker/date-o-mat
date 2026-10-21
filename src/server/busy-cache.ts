// The swipe page refreshes every 15–30 s; its free evenings need not ask Google each time.
// Busy times of a couple stay in memory for a few minutes (never stored), and are dropped as soon
// as a date is planned, moved or cancelled – that changes the calendars.
import "server-only";
import type { TimeRange } from "@/core/ranges";

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { busy: TimeRange[]; from: number; until: number; at: number }>();

/** Busy times covering [from, until], fetched with `load` unless a fresh enough copy is here. */
export async function cachedBusy(coupleId: string, from: Date, until: Date, load: () => Promise<TimeRange[]>): Promise<TimeRange[]> {
  const hit = cache.get(coupleId);
  if (hit && Date.now() - hit.at < TTL_MS && hit.from <= from.getTime() && hit.until >= until.getTime()) return hit.busy;
  const busy = await load();
  cache.set(coupleId, { busy, from: from.getTime(), until: until.getTime(), at: Date.now() });
  return busy;
}

export function forgetBusy(coupleId: string): void {
  cache.delete(coupleId);
}
