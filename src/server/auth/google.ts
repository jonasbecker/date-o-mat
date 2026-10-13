import "server-only";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import { env } from "@/server/env";

// Login only needs the identity scopes. Calendar scopes are requested later,
// when a user connects their calendar (incremental authorization).
export const LOGIN_SCOPES = ["openid", "email", "profile"];

export type OAuthFlow = "login";

/** Short-lived state kept in an httpOnly cookie between redirect and callback. */
export type OAuthState = {
  state: string;
  codeVerifier: string;
  flow: OAuthFlow;
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

export async function buildAuthUrl(flow: OAuthFlow, state: string) {
  const client = oauthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const url = client.generateAuthUrl({
    scope: LOGIN_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    include_granted_scopes: true,
    prompt: "select_account",
  });
  return { url, codeVerifier };
}

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/** Exchanges the authorization code and verifies the ID token's signature and audience. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<GoogleIdentity> {
  const client = oauthClient();
  const { tokens } = await client.getToken({ code, codeVerifier });
  if (!tokens.id_token) throw new Error("Google returned no ID token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env().googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new Error("Google account has no verified email");
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.given_name || payload.name || payload.email.split("@")[0],
    avatarUrl: payload.picture ?? null,
  };
}
