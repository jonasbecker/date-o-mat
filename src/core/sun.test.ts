import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { daylightShare, sunTimes } from "./sun";

const ZONE = "Europe/Berlin";
const day = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });
/** "HH:MM" of an instant in Berlin time. */
const berlin = (date: Date) => DateTime.fromJSDate(date, { zone: ZONE }).toFormat("HH:mm");
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
// Expected values: an independent NOAA fractional-year implementation (cross-checked offline).
const near = (actual: string, expected: string, tolerance = 3) => expect(Math.abs(minutes(actual) - minutes(expected)), `${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);

describe("sunTimes (Köln)", () => {
  it("23 Oct 2026: the sun sets around 18:20 (summer time)", () => {
    const sun = sunTimes(day("2026-10-23"))!;
    near(berlin(sun.sunset), "18:25");
    near(berlin(sun.sunrise), "08:06");
  });

  it("20 Nov 2026: dark by half past four", () => {
    const sun = sunTimes(day("2026-11-20"))!;
    near(berlin(sun.sunset), "16:40");
    near(berlin(sun.sunrise), "07:55");
  });

  it("21 Jun 2026: the longest day", () => {
    const sun = sunTimes(day("2026-06-21"))!;
    near(berlin(sun.sunrise), "05:17");
    near(berlin(sun.sunset), "21:49");
  });

  it("25 Oct 2026, the day the clocks go back: times come out in winter time", () => {
    const sun = sunTimes(day("2026-10-25"))!;
    near(berlin(sun.sunset), "17:21");
    near(berlin(sun.sunrise), "07:10");
    // The one o'clock hour exists twice that night – the offset at sunset is +1.
    expect(DateTime.fromJSDate(sun.sunset, { zone: ZONE }).offset).toBe(60);
  });

  it("29 Mar 2026, the day the clocks go forward: times come out in summer time", () => {
    const sun = sunTimes(day("2026-03-29"))!;
    expect(DateTime.fromJSDate(sun.sunset, { zone: ZONE }).offset).toBe(120);
    near(berlin(sun.sunset), "19:58");
  });

  it("the day is longer in June than in December", () => {
    const length = (iso: string) => {
      const sun = sunTimes(day(iso))!;
      return sun.sunset.getTime() - sun.sunrise.getTime();
    };
    expect(length("2026-06-21")).toBeGreaterThan(length("2026-12-21") * 1.9);
  });
});

describe("daylightShare", () => {
  it("is 1 in the afternoon and 0 at night", () => {
    expect(daylightShare(day("2026-10-24T14:00").toJSDate(), day("2026-10-24T16:00").toJSDate())).toBe(1);
    expect(daylightShare(day("2026-10-23T20:00").toJSDate(), day("2026-10-23T22:00").toJSDate())).toBe(0);
  });

  it("the Friday evening picnic of 23 Oct: 18:30–20:30 is after sunset", () => {
    expect(daylightShare(day("2026-10-23T18:30").toJSDate(), day("2026-10-23T20:30").toJSDate())).toBe(0);
  });

  it("a slot that crosses sunset only counts the light part", () => {
    const share = daylightShare(day("2026-10-23T17:20").toJSDate(), day("2026-10-23T19:20").toJSDate());
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it("20 Nov 18:00–20:00 has no daylight, 14:00–16:00 has all of it", () => {
    expect(daylightShare(day("2026-11-20T18:00").toJSDate(), day("2026-11-20T20:00").toJSDate())).toBe(0);
    expect(daylightShare(day("2026-11-20T14:00").toJSDate(), day("2026-11-20T16:00").toJSDate())).toBe(1);
  });

  it("a long day trip is half in the dark in winter", () => {
    const share = daylightShare(day("2026-12-12T10:00").toJSDate(), day("2026-12-12T20:00").toJSDate());
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.7);
  });

  it("an empty span counts as light", () => {
    const t = day("2026-10-23T20:00").toJSDate();
    expect(daylightShare(t, t)).toBe(1);
  });
});
