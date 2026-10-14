import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { buildIdeaPrompt, cleanAiIdeas, summarizeWeather, type HourlyWeather, type IdeaContext } from "./ai-ideas";

const ZONE = "Europe/Berlin";
const at = (s: string) => DateTime.fromISO(s, { zone: ZONE }).toJSDate();

const hourly: HourlyWeather = {
  time: ["2026-10-17T17:00", "2026-10-17T18:00", "2026-10-17T19:00", "2026-10-17T20:00", "2026-10-17T21:00"],
  temperature_2m: [16.2, 15.1, 13.6, 12.4, 11.9],
  precipitation_probability: [10, 20, 65, 70, 30],
  weather_code: [2, 3, 61, 63, 3],
};

describe("summarizeWeather", () => {
  it("covers only the slot hours", () => {
    expect(summarizeWeather(hourly, at("2026-10-17T18:00"), at("2026-10-17T21:00"))).toBe("12–15 °C, Regen wahrscheinlich (bis 70 %), Regen");
  });
  it("dry and clear", () => {
    expect(summarizeWeather({ time: ["2026-10-17T12:00"], temperature_2m: [20], precipitation_probability: [5], weather_code: [0] }, at("2026-10-17T12:00"), at("2026-10-17T13:00"))).toBe("20 °C, trocken, klar");
  });
  it("null outside the forecast", () => {
    expect(summarizeWeather(hourly, at("2026-10-30T18:00"), at("2026-10-30T21:00"))).toBeNull();
  });
});

describe("buildIdeaPrompt", () => {
  const base: IdeaContext = {
    now: at("2026-10-14T12:00"),
    slot: { start: at("2026-10-17T18:00"), end: at("2026-10-17T21:00") },
    weather: "12–15 °C, Regen wahrscheinlich (bis 70 %), Regen",
    budget: "low",
    mood: "cozy",
    setting: "indoor",
    wishlist: ["Kino", "Bouldern"],
    pastDates: [{ title: "Picknick", hearts: 5 }, { title: "Museum", hearts: null }],
  };
  it("contains time, weather, budget, mood and taste – but no names", () => {
    const prompt = buildIdeaPrompt(base);
    expect(prompt).toContain("Samstag, 17. Oktober, 18:00, about 3 hours");
    expect(prompt).toContain("Regen wahrscheinlich");
    expect(prompt).toContain("at most about 20 euros");
    expect(prompt).toContain("cozy");
    expect(prompt).toContain("indoors");
    expect(prompt).toContain("Kino; Bouldern");
    expect(prompt).toContain("Picknick (5)");
    expect(prompt).not.toContain("Museum");
  });
  it("mentions a fixed size", () => {
    expect(buildIdeaPrompt({ ...base, size: "large" })).toContain("big date");
  });
  it("without a slot", () => {
    const prompt = buildIdeaPrompt({ ...base, slot: null, weather: null, setting: "any", wishlist: [], pastDates: [] });
    expect(prompt).toContain("No fixed time yet");
    expect(prompt).toContain("Weather in Cologne then: unknown");
    expect(prompt).not.toMatch(/indoors|outdoors|wishlist|Past dates/);
  });
});

describe("cleanAiIdeas", () => {
  const idea = (title: string, extra: Partial<Parameters<typeof cleanAiIdeas>[0][number]> = {}) => ({
    title, description: "Schön.", why: "Passt.", size: "small", cost_eur: 12.4, location: "Ehrenfeld", setting: "indoor", ...extra,
  });
  it("normalizes and limits to three", () => {
    const result = cleanAiIdeas([idea("A"), idea("B", { size: "large", cost_eur: -5 }), idea("C", { cost_eur: null }), idea("D")], []);
    expect(result.map((r) => [r.title, r.size, r.costEur])).toEqual([["A", "small", 12], ["B", "large", 0], ["C", "small", null]]);
  });
  it("skips wishlist duplicates and empty titles", () => {
    expect(cleanAiIdeas([idea("kino"), idea("  "), idea("Neu")], ["Kino"]).map((r) => r.title)).toEqual(["Neu"]);
  });
  it("the plan page fixes the size", () => {
    expect(cleanAiIdeas([idea("Y", { size: "large" })], [], "small")[0].size).toBe("small");
  });
  it("unknown values fall back safely", () => {
    expect(cleanAiIdeas([idea("X", { size: "huge", setting: "space" })], [])[0]).toMatchObject({ size: "small", setting: "outdoor" });
  });
});
