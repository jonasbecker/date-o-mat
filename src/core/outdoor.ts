// What makes a time good (or bad) for an idea outdoors: daylight and weather.
// Pure: sun times are computed, the hourly forecast comes in as plain data.

import { DateTime } from "luxon";
import { APP_TIMEZONE } from "@/lib/domain";
import type { HourlyWeather } from "./ai-ideas";
import { daylightShare, sunTimes } from "./sun";

/** Rain this likely (percent) makes an outdoor date a bad bet … */
export const RAIN_LIMIT = 60;
/** … and colder than this (°C, average over the slot) is no fun outdoors. */
export const COLD_LIMIT = 8;
// Big enough that a wet or freezing weekend afternoon (worth about 5 points) loses against a dry weekday.
const RAIN_PENALTY = 5;
const COLD_PENALTY = 4;

/**
 * Ideas whose point is the dark or the evening light – stars, sunsets, lit-up streets.
 * They do not lose points for the time after sunset. A word list instead of a field on the
 * idea: it covers ideas from every source (wishlist, deck, Köln list, AI) without a form
 * field, and a false hit only means a bit less penalty.
 */
const DARKNESS_WORDS = /stern|planetarium|sonnenunterg|sonnenaufg|lichter|beleucht|laterne|feuerwerk|nachtwander|nachtspazier|open[- ]?air[- ]?kino|bei nacht|im dunkeln|abendstimmung|nachtleben/i;

export function darknessWanted(title: string, note?: string | null): boolean {
  return DARKNESS_WORDS.test(`${title} ${note ?? ""}`);
}

export type OutdoorFacts = {
  /** Share (0–1) of the slot between sunrise and sunset. */
  daylight: number;
  sunset: Date | null;
  /** Average °C and highest rain probability (%) over the slot's hours – null without a forecast. */
  tempC: number | null;
  rain: number | null;
  /** WMO code of the worst hour, for the icon. */
  code: number | null;
};

export type OutdoorContext = {
  weather: HourlyWeather | null;
  /** Dark is welcome (see darknessWanted): the time after sunset costs nothing. */
  darknessOk?: boolean;
};

function weatherOf(hourly: HourlyWeather, start: Date, end: Date, zone: string): Pick<OutdoorFacts, "tempC" | "rain" | "code"> {
  const from = DateTime.fromJSDate(start, { zone }).startOf("hour");
  const to = DateTime.fromJSDate(end, { zone });
  const temps: number[] = [];
  const rain: number[] = [];
  const codes: number[] = [];
  hourly.time.forEach((t, i) => {
    const at = DateTime.fromISO(t, { zone });
    if (at < from || at >= to) return;
    if (hourly.temperature_2m[i] != null) temps.push(hourly.temperature_2m[i]!);
    if (hourly.precipitation_probability[i] != null) rain.push(hourly.precipitation_probability[i]!);
    if (hourly.weather_code[i] != null) codes.push(hourly.weather_code[i]!);
  });
  return {
    tempC: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
    rain: rain.length ? Math.max(...rain) : null,
    code: codes.length ? Math.max(...codes) : null,
  };
}

export function outdoorFacts(start: Date, end: Date, weather: HourlyWeather | null, zone = APP_TIMEZONE): OutdoorFacts {
  const sun = sunTimes(DateTime.fromJSDate(start, { zone }).startOf("day"));
  return {
    daylight: daylightShare(start, end, zone),
    sunset: sun?.sunset ?? null,
    ...(weather ? weatherOf(weather, start, end, zone) : { tempC: null, rain: null, code: null }),
  };
}

/**
 * Points added to a slot's score for an outdoor idea.
 * - Mostly after sunset: a strong penalty; partly: a smaller one; fully light: a little bonus.
 * - Weekend daytime (start 11–17): a bonus – the time for a picnic or a walk (not when the dark is the point).
 * - Rain ≥ 60 % or under 8 °C: a penalty each. No forecast = neutral.
 */
export function outdoorAdjustment(facts: OutdoorFacts, slot: { start: DateTime; darknessOk?: boolean }): number {
  let points = 0;
  if (!slot.darknessOk) {
    if (facts.daylight < 0.5) points -= 4;
    else if (facts.daylight < 0.85) points -= 2;
    else if (facts.daylight >= 0.99) points += 0.5;
  }
  const hour = slot.start.hour + slot.start.minute / 60;
  if (!slot.darknessOk && slot.start.weekday >= 6 && hour >= 11 && hour < 17) points += 1.5;
  if (facts.rain !== null && facts.rain >= RAIN_LIMIT) points -= RAIN_PENALTY;
  if (facts.tempC !== null && facts.tempC < COLD_LIMIT) points -= COLD_PENALTY;
  return points;
}

/** "☀️ 14°, trocken · hell bis 18:20" – why this time suits (or does not suit) an outdoor idea. */
export function outdoorReason(facts: OutdoorFacts, start: Date, options: { darknessOk?: boolean; zone?: string } = {}): string {
  const zone = options.zone ?? APP_TIMEZONE;
  const parts: string[] = [];
  if (facts.tempC !== null) {
    const wet = facts.rain !== null && facts.rain >= RAIN_LIMIT;
    const cold = facts.tempC < COLD_LIMIT;
    const icon = wet ? "🌧️" : cold ? "🥶" : facts.code !== null && facts.code >= 4 ? "☁️" : facts.rain !== null && facts.rain >= 30 ? "⛅" : "☀️";
    const rainText = wet ? "Regen angesagt" : facts.rain !== null && facts.rain >= 30 ? "evtl. Regen" : "trocken";
    parts.push(`${icon} ${Math.round(facts.tempC)}°, ${rainText}`);
  }
  if (!options.darknessOk && facts.sunset) {
    const sunset = DateTime.fromJSDate(facts.sunset, { zone });
    const label = sunset.toFormat("HH:mm");
    parts.push(start.getTime() >= facts.sunset.getTime() ? `schon dunkel (ab ${label})` : `hell bis ${label}`);
  }
  return parts.join(" · ");
}
