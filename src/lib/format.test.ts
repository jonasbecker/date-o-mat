import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { formatCycleRange, formatDeadline, timeLeftLabel } from "./format";

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
