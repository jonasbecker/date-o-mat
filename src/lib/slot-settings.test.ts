import { describe, expect, it } from "vitest";
import { formatHours, minutesToTime, parseSlotSettings, timeToMinutes } from "./slot-settings";

const VALID = {
  smallDurationMinutes: "120",
  smallStartFromMinute: "10:00",
  smallStartUntilMinute: "21:00",
  largeMinDurationMinutes: "300",
  largeStartFromMinute: "09:00",
  largeStartUntilMinute: "13:00",
  latestEndMinute: "23:00",
  minLeadHours: "12",
  bufferMinutes: "30",
  horizonDays: "14",
};

describe("time of day", () => {
  it("converts both ways", () => {
    expect(minutesToTime(600)).toBe("10:00");
    expect(minutesToTime(21 * 60 + 30)).toBe("21:30");
    expect(timeToMinutes("09:05")).toBe(545);
    expect(timeToMinutes("9:05")).toBe(545);
  });

  it.each(["", "24:00", "10:60", "zehn"])("rejects %j", (value) => {
    expect(timeToMinutes(value)).toBeNull();
  });

  it("formats durations", () => {
    expect(formatHours(60)).toBe("1 Std.");
    expect(formatHours(90)).toBe("1,5 Std.");
  });
});

describe("parseSlotSettings", () => {
  it("accepts the defaults", () => {
    expect(parseSlotSettings(VALID)).toEqual({
      ok: true,
      data: {
        smallDurationMinutes: 120,
        smallStartFromMinute: 600,
        smallStartUntilMinute: 1260,
        largeMinDurationMinutes: 300,
        largeStartFromMinute: 540,
        largeStartUntilMinute: 780,
        latestEndMinute: 1380,
        minLeadHours: 12,
        bufferMinutes: 30,
        horizonDays: 14,
      },
    });
  });

  it("only accepts values from the option lists", () => {
    const result = parseSlotSettings({ ...VALID, bufferMinutes: "17", horizonDays: "999" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["bufferMinutes", "horizonDays"]);
  });

  it("requires start windows that make sense", () => {
    const result = parseSlotSettings({ ...VALID, smallStartFromMinute: "22:00" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.smallStartUntilMinute).toBeDefined();
  });

  it("rejects a latest end before the last small date could end", () => {
    const result = parseSlotSettings({ ...VALID, latestEndMinute: "22:00" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.latestEndMinute).toBeDefined();
  });

  it("allows a latest end after midnight", () => {
    expect(parseSlotSettings({ ...VALID, latestEndMinute: "01:00" }).ok).toBe(true);
  });
});
