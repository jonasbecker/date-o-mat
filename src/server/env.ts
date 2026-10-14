import "server-only";
import { z } from "zod";
import { parseAllowlist } from "@/lib/allowlist";
import { parseKey } from "@/lib/crypto";

const schema = z.object({
  APP_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ALLOWED_EMAILS: z.string().min(1, "ALLOWED_EMAILS must list your two Google addresses"),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  // Only for tests: point Calendar API calls at a mock server.
  GOOGLE_API_BASE_URL: z.url().default("https://www.googleapis.com"),
  // Only for tests: where refresh tokens are exchanged.
  GOOGLE_OAUTH_TOKEN_URL: z.url().default("https://oauth2.googleapis.com/token"),
  CRON_SECRET: z.string().min(16).optional(),
  ENABLE_DEV_TOOLS: z.enum(["0", "1"]).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  // Claude reads the event sources. Without a key the feature is off.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Only for tests: point the weather forecast (Open-Meteo, no key needed) at a mock.
  WEATHER_API_BASE_URL: z.url().default("https://api.open-meteo.com"),
  // Photos (Vercel Blob, private store). Vercel sets it when the store is connected.
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  // Only for tests (and only with ENABLE_DEV_TOOLS=1): event sources on localhost/http.
  ALLOW_PRIVATE_EVENT_URLS: z.enum(["0", "1"]).optional(),
  // Only for tests: where shared TikTok/YouTube links are looked up (oEmbed).
  TIKTOK_OEMBED_URL: z.url().default("https://www.tiktok.com/oembed"),
  YOUTUBE_OEMBED_URL: z.url().default("https://www.youtube.com/oembed"),
});

export type Env = {
  appUrl: string;
  secureCookies: boolean;
  googleClientId: string;
  googleClientSecret: string;
  allowedEmails: Set<string>;
  tokenKey: Buffer;
  googleApiBaseUrl: string;
  googleTokenUrl: string;
  cronSecret: string | null;
  devTools: boolean;
  /** Null when push is not configured (VAPID keys missing). */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** Claude is configured (event sources are read). */
  ai: boolean;
  allowPrivateEventUrls: boolean;
  /** Where photos go: Vercel Blob, a local folder (dev only) or nowhere (feature off). */
  photoStorage: "blob" | "local" | null;
  weatherApiBaseUrl: string;
  anthropicBaseUrl: string;
  oembed: { tiktok: string; youtube: string };
};

let cached: Env | undefined;

/** Validated server configuration. Parsed lazily so `next build` works without secrets. */
export function env(): Env {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration (see .env.example):\n- ${fields.join("\n- ")}`);
  }
  const e = result.data;
  // On the live Vercel deployment, test-only switches are ignored – even if set by mistake.
  // (ENABLE_DEV_TOOLS stays usable there on purpose: the dev clock is how rounds are tested, see SETUP.)
  const production = process.env.VERCEL_ENV === "production";
  const testOverrides = ["ALLOW_PRIVATE_EVENT_URLS", "GOOGLE_API_BASE_URL", "GOOGLE_OAUTH_TOKEN_URL", "WEATHER_API_BASE_URL", "ANTHROPIC_BASE_URL", "TIKTOK_OEMBED_URL", "YOUTUBE_OEMBED_URL"].filter((key) => process.env[key]);
  if (production && testOverrides.length) {
    console.warn(`[env] ignoring test-only settings in production: ${testOverrides.join(", ")}`);
  }
  const devTools = e.ENABLE_DEV_TOOLS === "1";
  cached = {
    appUrl: e.APP_URL,
    secureCookies: e.APP_URL.startsWith("https://"),
    googleClientId: e.GOOGLE_CLIENT_ID,
    googleClientSecret: e.GOOGLE_CLIENT_SECRET,
    allowedEmails: parseAllowlist(e.ALLOWED_EMAILS),
    tokenKey: parseKey(e.TOKEN_ENCRYPTION_KEY),
    googleApiBaseUrl: production ? "https://www.googleapis.com" : e.GOOGLE_API_BASE_URL.replace(/\/+$/, ""),
    googleTokenUrl: production ? "https://oauth2.googleapis.com/token" : e.GOOGLE_OAUTH_TOKEN_URL,
    cronSecret: e.CRON_SECRET ?? null,
    devTools,
    vapid:
      e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY
        ? { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT ?? e.APP_URL }
        : null,
    ai: Boolean(e.ANTHROPIC_API_KEY),
    allowPrivateEventUrls: !production && devTools && e.ALLOW_PRIVATE_EVENT_URLS === "1",
    weatherApiBaseUrl: production ? "https://api.open-meteo.com" : e.WEATHER_API_BASE_URL.replace(/\/+$/, ""),
    anthropicBaseUrl: production ? "https://api.anthropic.com" : (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"),
    oembed: production
      ? { tiktok: "https://www.tiktok.com/oembed", youtube: "https://www.youtube.com/oembed" }
      : { tiktok: e.TIKTOK_OEMBED_URL, youtube: e.YOUTUBE_OEMBED_URL },
    photoStorage: e.BLOB_READ_WRITE_TOKEN ? "blob" : !production && devTools ? "local" : null,
  };
  return cached;
}
