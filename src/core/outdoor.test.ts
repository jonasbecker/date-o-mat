import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import type { HourlyWeather } from "./ai-ideas";
import { COLD_LIMIT, darknessWanted, outdoorAdjustment, outdoorFacts, outdoorReason, RAIN_LIMIT } from "./outdoor";

const ZONE = "Europe/Berlin";
const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });

/** Hourly forecast for the given days: `shape(hour)` → [°C, rain %, WMO code]. */
function forecast(from: string, days: number, shape: (dt: DateTime) => [number, number, number]): HourlyWeather {
  const hourly: HourlyWeather = { time: [], temperature_2m: [], precipitation_probability: [], weather_code: [] };
  for (let t = at(from).startOf("day"); t < at(from).startOf("day").plus({ days }); t = t.plus({ hours: 1 })) {
    const [temp, rain, code] = shape(t);
    hourly.time.push(t.toFormat("yyyy-LL-dd'T'HH:mm"));
    hourly.temperature_2m.push(temp);
    hourly.precipitation_probability.push(rain);
    hourly.weather_code.push(code);
  }
  return hourly;
}
const MILD_DRY = forecast("2026-10-23", 3, () => [14, 5, 1]);

describe("darknessWanted", () => {
  it("knows ideas that need the dark or the evening light", () => {
    for (const title of ["Sterne gucken im Stadtwald", "Sonnenuntergang am Rheinboulevard", "Lichterspaziergang Altstadt", "Planetarium", "Feuerwerk am Rhein", "Open-Air-Kino"]) {
      expect(darknessWanted(title), title).toBe(true);
    }
  });

  it("reads the note too, and leaves everyday outdoor ideas alone", () => {
    expect(darknessWanted("Spaziergang", "Danach Lichter am Dom ansehen")).toBe(true);
    for (const title of ["Picknick im Stadtwald", "Runde um den Decksteiner Weiher", "Ruderboot auf dem Stadtwaldweiher", "Minigolf"]) {
      expect(darknessWanted(title), title).toBe(false);
    }
  });
});

describe("outdoorFacts", () => {
  it("23 Oct, 18:30–20:30: no daylight left, forecast read for those hours", () => {
    const facts = outdoorFacts(at("2026-10-23T18:30").toJSDate(), at("2026-10-23T20:30").toJSDate(), MILD_DRY);
    expect(facts.daylight).toBe(0);
    expect(facts.tempC).toBe(14);
    expect(facts.rain).toBe(5);
  });

  it("without a forecast the weather is unknown, not bad", () => {
    const facts = outdoorFacts(at("2026-10-24T14:00").toJSDate(), at("2026-10-24T16:00").toJSDate(), null);
    expect(facts.tempC).toBeNull();
    expect(facts.rain).toBeNull();
    expect(facts.daylight).toBe(1);
  });
});

describe("outdoorAdjustment", () => {
  const start = at("2026-10-24T14:00"); // Saturday afternoon
  const light = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), MILD_DRY);

  it("a weekend afternoon in the light gets a bonus", () => {
    expect(outdoorAdjustment(light, { start })).toBeGreaterThan(1.5);
  });

  it("the evening after sunset gets a strong penalty", () => {
    const friday = at("2026-10-23T18:30");
    const dark = outdoorFacts(friday.toJSDate(), friday.plus({ hours: 2 }).toJSDate(), MILD_DRY);
    expect(outdoorAdjustment(dark, { start: friday })).toBe(-4);
  });

  it("…unless the dark is the point", () => {
    const friday = at("2026-10-23T18:30");
    const dark = outdoorFacts(friday.toJSDate(), friday.plus({ hours: 2 }).toJSDate(), MILD_DRY);
    expect(outdoorAdjustment(dark, { start: friday, darknessOk: true })).toBe(0);
  });

  it("rain and cold cost points, also in the dark-is-fine case", () => {
    const wet = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), forecast("2026-10-24", 1, () => [14, RAIN_LIMIT, 61]));
    const cold = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), forecast("2026-10-24", 1, () => [COLD_LIMIT - 1, 0, 1]));
    expect(outdoorAdjustment(wet, { start })).toBeLessThanOrEqual(outdoorAdjustment(light, { start }) - 4);
    expect(outdoorAdjustment(cold, { start })).toBeLessThanOrEqual(outdoorAdjustment(light, { start }) - 3);
    expect(outdoorAdjustment(wet, { start, darknessOk: true })).toBeLessThan(outdoorAdjustment(light, { start, darknessOk: true }));
  });

  it("just under the limits is fine", () => {
    const edge = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), forecast("2026-10-24", 1, () => [COLD_LIMIT, RAIN_LIMIT - 1, 3]));
    expect(outdoorAdjustment(edge, { start })).toBe(outdoorAdjustment(light, { start }));
  });
});

describe("outdoorReason", () => {
  it("says weather and when it gets dark", () => {
    const start = at("2026-10-24T14:00");
    const facts = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), MILD_DRY);
    expect(outdoorReason(facts, start.toJSDate())).toMatch(/^☀️ 14°, trocken · hell bis 18:2\d$/);
  });

  it("warns about rain and cold", () => {
    const start = at("2026-10-24T14:00");
    const wet = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), forecast("2026-10-24", 1, () => [12, 80, 63]));
    expect(outdoorReason(wet, start.toJSDate())).toContain("🌧️ 12°, Regen angesagt");
    const cold = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), forecast("2026-10-24", 1, () => [4, 0, 1]));
    expect(outdoorReason(cold, start.toJSDate())).toContain("🥶 4°");
  });

  it("an evening slot is marked as dark", () => {
    const start = at("2026-10-23T18:30");
    const facts = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), MILD_DRY);
    expect(outdoorReason(facts, start.toJSDate())).toContain("schon dunkel (ab 18:2");
  });

  it("without a forecast only the light is named; with darkness welcome nothing about it", () => {
    const start = at("2026-10-24T14:00");
    const facts = outdoorFacts(start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), null);
    expect(outdoorReason(facts, start.toJSDate())).toMatch(/^hell bis 18:2\d$/);
    expect(outdoorReason(facts, start.toJSDate(), { darknessOk: true })).toBe("");
  });
});
