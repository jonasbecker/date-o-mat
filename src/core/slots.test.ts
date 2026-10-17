import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { mergeRanges, subtractRanges } from "./ranges";
import { findSlots, orderSlots, type SlotRules } from "./slots";

const ZONE = "Europe/Berlin";

// The app defaults (see couple_settings).
const RULES: SlotRules = {
  smallDurationMinutes: 120,
  smallStartFromMinute: 10 * 60,
  smallStartUntilMinute: 21 * 60,
  largeMinDurationMinutes: 300,
  largeMaxDurationMinutes: 540,
  largeStartFromMinute: 9 * 60,
  largeStartUntilMinute: 13 * 60,
  latestEndMinute: 23 * 60,
  minLeadHours: 12,
  bufferMinutes: 30,
};

/** Local Berlin wall-clock time → Date, e.g. at("2026-10-16T18:00"). */
function at(local: string): Date {
  return DateTime.fromISO(local, { zone: ZONE }).toJSDate();
}
function range(from: string, to: string) {
  return { start: at(from).getTime(), end: at(to).getTime() };
}
function local(date: Date) {
  return DateTime.fromJSDate(date, { zone: ZONE });
}
function minuteOfDay(date: Date) {
  const d = local(date);
  return d.hour * 60 + d.minute;
}

// Tuesday 13 Oct 2026, 09:00 – the week runs until Sunday night.
const NOW = at("2026-10-13T09:00");
const UNTIL = at("2026-10-19T00:00");

describe("ranges", () => {
  it("merges overlapping and touching ranges", () => {
    expect(
      mergeRanges([
        { start: 5, end: 8 },
        { start: 1, end: 3 },
        { start: 3, end: 4 },
        { start: 7, end: 10 },
      ]),
    ).toEqual([
      { start: 1, end: 4 },
      { start: 5, end: 10 },
    ]);
  });

  it("subtracts busy ranges from a window", () => {
    expect(subtractRanges({ start: 0, end: 10 }, [{ start: 2, end: 4 }, { start: 8, end: 12 }])).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 8 },
    ]);
    expect(subtractRanges({ start: 0, end: 10 }, [{ start: -5, end: 20 }])).toEqual([]);
  });
});

describe("findSlots – small dates", () => {
  const slots = findSlots({ now: NOW, until: UNTIL, busy: [], rules: RULES, size: "small" });

  it("returns at most five slots, best first", () => {
    expect(slots).toHaveLength(5);
    for (let i = 1; i < slots.length; i++) expect(slots[i - 1].score).toBeGreaterThanOrEqual(slots[i].score);
  });

  it("respects the daily window, the duration and the 30-minute grid", () => {
    for (const slot of slots) {
      expect(minuteOfDay(slot.start)).toBeGreaterThanOrEqual(10 * 60);
      expect(minuteOfDay(slot.start)).toBeLessThanOrEqual(21 * 60);
      expect(minuteOfDay(slot.end)).toBeLessThanOrEqual(23 * 60);
      expect(slot.end.getTime() - slot.start.getTime()).toBe(120 * 60_000);
      expect(local(slot.start).minute % 30).toBe(0);
    }
  });

  it("offers at most one slot per day", () => {
    const days = slots.map((s) => local(s.start).toISODate());
    expect(new Set(days).size).toBe(days.length);
  });

  it("never proposes something before the minimum lead time", () => {
    for (const slot of slots) expect(slot.start.getTime()).toBeGreaterThanOrEqual(NOW.getTime() + 12 * 3_600_000);
  });

  it("prefers Friday evening or the weekend for the top slot", () => {
    const top = local(slots[0].start);
    expect(top.weekday === 5 ? top.hour >= 17 : top.weekday >= 6).toBe(true);
  });
});

describe("findSlots – busy times", () => {
  it("keeps the buffer around appointments", () => {
    const busy = [range("2026-10-16T18:00", "2026-10-16T19:00")];
    const slots = findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size: "small", limit: 10 });
    const friday = slots.find((s) => local(s.start).weekday === 5);
    expect(friday).toBeDefined();
    const blockedFrom = at("2026-10-16T17:30").getTime();
    const blockedTo = at("2026-10-16T19:30").getTime();
    expect(friday!.end.getTime() <= blockedFrom || friday!.start.getTime() >= blockedTo).toBe(true);
  });

  it("only offers times when both partners are free", () => {
    const jonas = [range("2026-10-17T00:00", "2026-10-17T14:00")];
    const sam = [range("2026-10-17T16:00", "2026-10-18T00:00")];
    const slots = findSlots({ now: NOW, until: UNTIL, busy: [...jonas, ...sam], rules: RULES, size: "small", limit: 10 });
    const saturday = slots.filter((s) => local(s.start).weekday === 6);
    // Free: 14:30 (after buffer) … 15:30 → too short for 2 h.
    expect(saturday).toHaveLength(0);
  });

  it("blocks the whole day for an all-day busy event", () => {
    // FreeBusy reports all-day events marked "busy" as local midnight to midnight.
    const busy = [range("2026-10-17T00:00", "2026-10-18T00:00")];
    for (const size of ["small", "large"] as const) {
      const slots = findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size, limit: 10 });
      expect(slots.some((s) => local(s.start).weekday === 6)).toBe(false);
    }
  });

  it("handles appointments across midnight", () => {
    const busy = [range("2026-10-16T22:00", "2026-10-17T11:00")];
    const slots = findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size: "small", limit: 10 });
    const friday = slots.find((s) => local(s.start).weekday === 5)!;
    const saturday = slots.find((s) => local(s.start).weekday === 6)!;
    expect(friday.end.getTime()).toBeLessThanOrEqual(at("2026-10-16T21:30").getTime());
    expect(saturday.start.getTime()).toBeGreaterThanOrEqual(at("2026-10-17T11:30").getTime());
  });

  it("returns an empty list when the calendars are full", () => {
    const busy = [range("2026-10-13T00:00", "2026-10-20T00:00")];
    expect(findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size: "small" })).toEqual([]);
    expect(findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size: "large" })).toEqual([]);
  });

  it("returns nothing when the lead time reaches past the window", () => {
    expect(findSlots({ now: NOW, until: at("2026-10-13T20:00"), busy: [], rules: RULES, size: "small" })).toEqual([]);
  });

  it("does not offer slots that end after the search window", () => {
    const until = at("2026-10-16T19:00");
    const slots = findSlots({ now: NOW, until, busy: [], rules: RULES, size: "small", limit: 10 });
    for (const slot of slots) expect(slot.end.getTime()).toBeLessThanOrEqual(until.getTime());
  });

  it("skips the rest of today when the lead time pushes past the window", () => {
    const now = at("2026-10-13T10:00"); // + 12 h = 22:00, later than the last start at 21:00
    const slots = findSlots({ now, until: UNTIL, busy: [], rules: RULES, size: "small", limit: 10 });
    expect(slots.some((s) => local(s.start).toISODate() === "2026-10-13")).toBe(false);
  });
});

describe("findSlots – large dates", () => {
  it("prefers the weekend and uses as much time as possible (max 9 h)", () => {
    const slots = findSlots({ now: NOW, until: UNTIL, busy: [], rules: RULES, size: "large" });
    const top = slots[0];
    expect(local(top.start).weekday).toBeGreaterThanOrEqual(6);
    expect(top.end.getTime() - top.start.getTime()).toBe(9 * 3_600_000);
  });

  it("needs at least five free hours", () => {
    // Saturday: free only 10:00–15:00 incl. buffer → 4 h net
    const busy = [range("2026-10-17T00:00", "2026-10-17T10:30"), range("2026-10-17T14:30", "2026-10-18T00:00")];
    const slots = findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size: "large", limit: 10 });
    expect(slots.some((s) => local(s.start).weekday === 6)).toBe(false);
  });

  it("rounds the length down to half hours", () => {
    const busy = [range("2026-10-17T16:45", "2026-10-18T00:00")];
    const slots = findSlots({ now: NOW, until: UNTIL, busy, rules: RULES, size: "large", limit: 10 });
    const saturday = slots.find((s) => local(s.start).weekday === 6)!;
    expect(((saturday.end.getTime() - saturday.start.getTime()) / 60_000) % 30).toBe(0);
    expect(saturday.end.getTime()).toBeLessThanOrEqual(at("2026-10-17T16:15").getTime());
  });
});

describe("findSlots – daylight saving time", () => {
  it("keeps wall-clock times on the day clocks go back (25 Oct 2026)", () => {
    const slots = findSlots({
      now: at("2026-10-24T08:00"),
      until: at("2026-10-26T00:00"),
      busy: [],
      rules: RULES,
      size: "large",
    });
    const sunday = slots.find((s) => local(s.start).toISODate() === "2026-10-25")!;
    expect(local(sunday.start).hour).toBeGreaterThanOrEqual(9);
    expect(local(sunday.start).offset).toBe(60); // CET, UTC+1
    expect(minuteOfDay(sunday.end)).toBeLessThanOrEqual(23 * 60);
    expect(sunday.end.getTime() - sunday.start.getTime()).toBeLessThanOrEqual(9 * 3_600_000);
  });

  it("keeps wall-clock times on the day clocks go forward (28 Mar 2027)", () => {
    const slots = findSlots({
      now: at("2027-03-27T08:00"),
      until: at("2027-03-29T00:00"),
      busy: [],
      rules: RULES,
      size: "small",
      limit: 10,
    });
    const sunday = slots.find((s) => local(s.start).toISODate() === "2027-03-28")!;
    expect(local(sunday.start).offset).toBe(120); // CEST, UTC+2
    expect(minuteOfDay(sunday.start)).toBeGreaterThanOrEqual(10 * 60);
    expect(local(sunday.start).minute % 30).toBe(0);
    expect(sunday.end.getTime() - sunday.start.getTime()).toBe(2 * 3_600_000);
  });

  it("treats a busy event spanning the DST switch correctly", () => {
    // 01:00–03:00 local on 25 Oct is three real hours; it must not leak into the day.
    const busy = [range("2026-10-25T01:00", "2026-10-25T03:00")];
    const slots = findSlots({ now: at("2026-10-24T08:00"), until: at("2026-10-26T00:00"), busy, rules: RULES, size: "small", limit: 10 });
    expect(slots.some((s) => local(s.start).toISODate() === "2026-10-25")).toBe(true);
  });
});

describe("orderSlots", () => {
  it("keeps the Top-Tipp first and sorts the rest by date", () => {
    const at = (iso: string) => ({ startIso: iso });
    expect(orderSlots([at("2026-10-16T16:00:00Z"), at("2026-10-14T16:00:00Z"), at("2026-10-18T09:00:00Z"), at("2026-10-15T16:00:00Z")]).map((s) => s.startIso.slice(8, 10))).toEqual(["16", "14", "15", "18"]);
    expect(orderSlots([])).toEqual([]);
  });
});
