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
  CRON_SECRET: z.string().min(16).optional(),
  ENABLE_DEV_TOOLS: z.enum(["0", "1"]).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).optional(),
  // Claude reads the event sources. Without a key the feature is off.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Only for tests (and only with ENABLE_DEV_TOOLS=1): event sources on localhost/http.
  ALLOW_PRIVATE_EVENT_URLS: z.enum(["0", "1"]).optional(),
});

export type Env = {
  appUrl: string;
  secureCookies: boolean;
  googleClientId: string;
  googleClientSecret: string;
  allowedEmails: Set<string>;
  tokenKey: Buffer;
  googleApiBaseUrl: string;
  cronSecret: string | null;
  devTools: boolean;
  /** Null when push is not configured (VAPID keys missing). */
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  /** Claude is configured (event sources are read). */
  ai: boolean;
  allowPrivateEventUrls: boolean;
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
  cached = {
    appUrl: e.APP_URL,
    secureCookies: e.APP_URL.startsWith("https://"),
    googleClientId: e.GOOGLE_CLIENT_ID,
    googleClientSecret: e.GOOGLE_CLIENT_SECRET,
    allowedEmails: parseAllowlist(e.ALLOWED_EMAILS),
    tokenKey: parseKey(e.TOKEN_ENCRYPTION_KEY),
    googleApiBaseUrl: e.GOOGLE_API_BASE_URL.replace(/\/+$/, ""),
    cronSecret: e.CRON_SECRET ?? null,
    devTools: e.ENABLE_DEV_TOOLS === "1",
    vapid:
      e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY
        ? { publicKey: e.VAPID_PUBLIC_KEY, privateKey: e.VAPID_PRIVATE_KEY, subject: e.VAPID_SUBJECT ?? e.APP_URL }
        : null,
    ai: Boolean(e.ANTHROPIC_API_KEY),
    allowPrivateEventUrls: e.ENABLE_DEV_TOOLS === "1" && e.ALLOW_PRIVATE_EVENT_URLS === "1",
  };
  return cached;
}
