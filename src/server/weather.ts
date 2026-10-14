// Weather forecast for Cologne from Open-Meteo (free, no key). Best effort:
// any problem just means "weather unknown".
import "server-only";
import { DateTime } from "luxon";
import { summarizeWeather, type HourlyWeather } from "@/core/ai-ideas";
import { APP_TIMEZONE } from "@/lib/domain";
import { env } from "@/server/env";

const COLOGNE = { latitude: 50.94, longitude: 6.96 };
const FORECAST_DAYS = 15;

export async function weatherFor(start: Date, end: Date, now: Date): Promise<string | null> {
  if (start.getTime() - now.getTime() > (FORECAST_DAYS - 1) * 86_400_000 || end < now) return null;
  const day = (d: Date) => DateTime.fromJSDate(d, { zone: APP_TIMEZONE }).toISODate()!;
  const params = new URLSearchParams({
    latitude: String(COLOGNE.latitude),
    longitude: String(COLOGNE.longitude),
    hourly: "temperature_2m,precipitation_probability,weather_code",
    timezone: APP_TIMEZONE,
    start_date: day(start),
    end_date: day(end),
  });
  try {
    const response = await fetch(`${env().weatherApiBaseUrl}/v1/forecast?${params}`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { hourly?: HourlyWeather };
    return data.hourly ? summarizeWeather(data.hourly, start, end) : null;
  } catch {
    return null;
  }
}
