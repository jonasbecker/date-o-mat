// Weather forecast for Cologne from Open-Meteo (free, no key). Best effort:
// any problem just means "weather unknown".
import "server-only";
import { DateTime } from "luxon";
import { summarizeWeather, type HourlyWeather } from "@/core/ai-ideas";
import { APP_TIMEZONE } from "@/lib/domain";
import { env } from "@/server/env";

const COLOGNE = { latitude: 50.94, longitude: 6.96 };
const FORECAST_DAYS = 15;

/**
 * The hourly forecast for the days from `start` to `end` (as far as Open-Meteo has it),
 * or null: too far ahead, no answer, anything wrong. One request.
 */
export async function hourlyWeather(start: Date, end: Date, now: Date): Promise<HourlyWeather | null> {
  if (start.getTime() - now.getTime() > (FORECAST_DAYS - 1) * 86_400_000 || end < now) return null;
  // Days beyond the forecast are simply left out (their slots count as "weather unknown").
  const lastDay = new Date(Math.min(end.getTime(), now.getTime() + (FORECAST_DAYS - 1) * 86_400_000));
  const day = (d: Date) => DateTime.fromJSDate(d, { zone: APP_TIMEZONE }).toISODate()!;
  const params = new URLSearchParams({
    latitude: String(COLOGNE.latitude),
    longitude: String(COLOGNE.longitude),
    hourly: "temperature_2m,precipitation_probability,weather_code",
    timezone: APP_TIMEZONE,
    start_date: day(start),
    end_date: day(lastDay),
  });
  try {
    const response = await fetch(`${env().weatherApiBaseUrl}/v1/forecast?${params}`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { hourly?: HourlyWeather };
    return data.hourly ?? null;
  } catch {
    return null;
  }
}

/** The forecast as one line for Claude and the UI ("12–15 °C, trocken"). */
export async function weatherFor(start: Date, end: Date, now: Date): Promise<string | null> {
  const hourly = await hourlyWeather(start, end, now);
  return hourly ? summarizeWeather(hourly, start, end) : null;
}
