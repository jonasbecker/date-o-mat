import "server-only";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { CALENDAR_SCOPES } from "@/core/calendars";
import { env } from "@/server/env";

// Login only needs the identity scopes. Calendar scopes are requested
// separately when someone connects their calendar (incremental authorization).
export const LOGIN_SCOPES = ["openid", "email", "profile"];

export type OAuthFlow = "login" | "calendar";

/** Where to go after connecting the calendar – a fixed list, never a free URL. */
export const RETURN_PATHS = ["/", "/plan", "/settings"] as const;
export type ReturnPath = (typeof RETURN_PATHS)[number];

/** Short-lived state kept in an httpOnly cookie between redirect and callback. */
export type OAuthState = {
  state: string;
  codeVerifier: string;
  flow: OAuthFlow;
  returnTo?: ReturnPath;
};

export function callbackUrl(): string {
  return `${env().appUrl}/api/auth/google/callback`;
}

export function oauthClient(): OAuth2Client {
  const { googleClientId, googleClientSecret } = env();
  return new OAuth2Client({
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUri: callbackUrl(),
  });
}

export async function buildAuthUrl(flow: OAuthFlow, state: string, loginHint?: string) {
  const client = oauthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const url = client.generateAuthUrl({
    scope: flow === "login" ? LOGIN_SCOPES : ["openid", "email", ...CALENDAR_SCOPES],
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    include_granted_scopes: true,
    // The calendar flow needs a refresh token for background jobs; Google only
    // hands one out reliably with access_type=offline + prompt=consent.
    ...(flow === "calendar"
      ? { access_type: "offline", prompt: "consent", login_hint: loginHint }
      : { prompt: "select_account" }),
  });
  return { url, codeVerifier };
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type GoogleTokens = {
  refreshToken: string | null;
  accessToken: string | null;
  expiresAt: Date | null;
  scope: string;
};

/** Exchanges the authorization code and verifies the ID token's signature and audience. */
export async function exchangeCode(
  code: string,
  codeVerifier: string,
): Promise<{ identity: GoogleIdentity; tokens: GoogleTokens }> {
  const client = oauthClient();
  const { tokens } = await client.getToken({ code, codeVerifier });
  if (!tokens.id_token) throw new Error("Google returned no ID token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env().googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error("Google account has no verified email");
  }
  return {
    identity: {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.given_name || payload.name || payload.email.split("@")[0],
      avatarUrl: payload.picture ?? null,
    },
    tokens: {
      refreshToken: tokens.refresh_token ?? null,
      accessToken: tokens.access_token ?? null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? "",
    },
  };
}
