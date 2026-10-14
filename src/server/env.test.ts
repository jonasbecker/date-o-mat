import { afterEach, describe, expect, it, vi } from "vitest";

const BASE = {
  APP_URL: "https://dates.example.com",
  DATABASE_URL: "postgres://x",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  ALLOWED_EMAILS: "a@example.com,b@example.com",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  ENABLE_DEV_TOOLS: "1",
  ALLOW_PRIVATE_EVENT_URLS: "1",
  GOOGLE_API_BASE_URL: "http://localhost:4010",
  WEATHER_API_BASE_URL: "http://localhost:4050",
  ANTHROPIC_BASE_URL: "http://localhost:4030",
};

async function loadEnv(extra: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE, ...extra })) vi.stubEnv(key, value);
  const { env } = await import("./env");
  return env();
}

afterEach(() => vi.unstubAllEnvs());

describe("env", () => {
  it("test switches work outside production", async () => {
    const e = await loadEnv({});
    expect(e).toMatchObject({ allowPrivateEventUrls: true, photoStorage: "local", googleApiBaseUrl: "http://localhost:4010", anthropicBaseUrl: "http://localhost:4030" });
  });
  it("on the live Vercel deployment they are ignored (the dev clock stays)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const e = await loadEnv({ VERCEL_ENV: "production" });
    expect(e).toMatchObject({
      devTools: true,
      allowPrivateEventUrls: false,
      photoStorage: null,
      googleApiBaseUrl: "https://www.googleapis.com",
      weatherApiBaseUrl: "https://api.open-meteo.com",
      anthropicBaseUrl: "https://api.anthropic.com",
    });
  });
});
