import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { dayLabel, eventWhen, firstFree, freeWhen, nextWeekendEvening } from "./card-when";
import type { Slot } from "./slots";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "Europe/Berlin" }).toJSDate();
const slot = (iso: string, size: "small" | "large" = "small"): Slot => ({ start: at(iso), end: new Date(at(iso).getTime() + 2 * 3_600_000), size, score: 1, mood: "evening" });

describe("card dates", () => {
  it("labels a day like the mockup", () => {
    expect(dayLabel(at("2026-10-31T20:00"))).toBe("Sa 31.10.");
    expect(dayLabel(at("2026-10-23T18:00"))).toBe("Fr 23.10.");
  });

  it("shows a combo card's event and whether both are free", () => {
    expect(eventWhen({ startsAt: at("2026-10-31T20:00"), allDay: false }, true)).toEqual({ day: "Sa 31.10.", time: "20:00 Uhr", free: true, note: "✓ ihr habt beide Zeit" });
    expect(eventWhen({ startsAt: at("2026-10-31T00:00"), allDay: true }, false).note).toBe("✗ da habt ihr was vor");
    expect(eventWhen({ startsAt: at("2026-10-31T20:00"), allDay: false }, null).note).toBe("kalender fehlt");
  });

  it("picks the earliest free evening for small ideas, any time for long ones", () => {
    const slots = [slot("2026-10-24T19:00"), slot("2026-10-22T11:00"), slot("2026-10-23T18:00")];
    expect(firstFree(slots, "small")?.start).toEqual(at("2026-10-23T18:00"));
    expect(firstFree(slots, "large")?.start).toEqual(at("2026-10-22T11:00"));
    expect(firstFree([slot("2026-10-22T11:00")], "small")?.start).toEqual(at("2026-10-22T11:00"));
    expect(firstFree([], "small")).toBeNull();
  });

  it("without calendars: the next Friday or Saturday evening", () => {
    expect(nextWeekendEvening(at("2026-10-20T10:00"))).toEqual(at("2026-10-23T18:00"));
    expect(nextWeekendEvening(at("2026-10-23T10:00"))).toEqual(at("2026-10-23T18:00"));
    expect(nextWeekendEvening(at("2026-10-23T19:00"))).toEqual(at("2026-10-24T18:00"));
    expect(nextWeekendEvening(at("2026-10-24T19:00"))).toEqual(at("2026-10-30T18:00"));
  });

  it("builds the line under the day", () => {
    const now = at("2026-10-20T10:00");
    expect(freeWhen(slot("2026-10-23T18:00"), now, true)).toEqual({ day: "Fr 23.10.", time: "ab 18:00", free: true, note: "✓ ihr habt beide Zeit" });
    expect(freeWhen(null, now, false)).toEqual({ day: "Fr 23.10.", time: "ab 18:00", free: null, note: "kalender fehlt" });
    expect(freeWhen(null, now, true).note).toBe("gerade nichts frei");
  });
});
