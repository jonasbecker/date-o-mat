import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { agoLabel, daysUntilLabel, genitive, dayHeading, formatClock, formatCycleRange, formatDeadline, shortDeadline, timeLeftLabel } from "./format";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Berlin" }).toJSDate();

describe("format", () => {
  it("formats round ranges within and across months", () => {
    expect(formatCycleRange(at("2026-10-12T00:00"), at("2026-10-19T00:00"))).toBe("12.–18. Okt");
    expect(formatCycleRange(at("2026-10-26T00:00"), at("2026-11-02T00:00"))).toBe("26. Okt – 1. Nov");
  });

  it("formats deadlines in Berlin time", () => {
    expect(formatDeadline(at("2026-10-15T20:00"))).toBe("Do, 15. Okt · 20:00");
  });

  it.each([
    ["2026-10-13T09:00", "noch 2 Tage"],
    ["2026-10-14T21:00", "noch 23 Std."],
    ["2026-10-15T19:30", "noch < 1 Std."],
    ["2026-10-15T20:00", "vorbei"],
  ])("time left from %s", (now, label) => {
    expect(timeLeftLabel(at(now), at("2026-10-15T20:00"))).toBe(label);
  });
});

describe("event list labels", () => {
  const now = at("2026-10-14T12:00");
  it("day headings", () => {
    expect(dayHeading(at("2026-10-14T20:00"), now)).toBe("Heute");
    expect(dayHeading(at("2026-10-15T00:30"), now)).toBe("Morgen");
    expect(dayHeading(at("2026-10-17T20:00"), now)).toBe("Samstag, 17. Okt");
  });
  it("clock", () => {
    expect(formatClock(at("2026-10-17T20:05"))).toBe("20:05");
  });
  it("ago", () => {
    expect(agoLabel(now, at("2026-10-14T11:59"))).toBe("gerade eben");
    expect(agoLabel(now, at("2026-10-14T09:00"))).toBe("vor 3 Std.");
    expect(agoLabel(now, at("2026-10-11T12:00"))).toBe("vor 3 Tagen");
  });
});

describe("daysUntilLabel", () => {
  const now = at("2026-10-14T22:00");
  it.each([
    ["2026-10-14T23:30", "heute"],
    ["2026-10-15T08:00", "morgen"],
    ["2026-10-16T19:00", "übermorgen"],
    ["2026-10-19T19:00", "in 5 Tagen"],
  ])("%s", (when, label) => expect(daysUntilLabel(now, at(when))).toBe(label));
});

describe("genitive", () => {
  it.each([["Sam", "Sams"], ["Jonas", "Jonas'"], ["Max", "Max'"], ["Fritz", "Fritz'"], ["Lea", "Leas"]])("%s → %s", (name, g) => expect(genitive(name)).toBe(g));
});

describe("shortDeadline", () => {
  it("weekday and hour, minutes only when needed", () => {
    expect(shortDeadline(new Date("2026-10-15T18:00:00Z"))).toBe("Do 20 Uhr");
    expect(shortDeadline(new Date("2026-10-15T18:30:00Z"))).toBe("Do 20:30 Uhr");
  });
});
