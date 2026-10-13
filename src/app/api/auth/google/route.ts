import { NextResponse } from "next/server";
import { OAUTH_COOKIE } from "@/lib/constants";
import { randomToken } from "@/lib/crypto";
import { buildAuthUrl, type OAuthState } from "@/server/auth/google";
import { env } from "@/server/env";

// Starts "Sign in with Google": remembers state + PKCE verifier, then redirects.
export async function GET() {
  const state = randomToken(16);
  const { url, codeVerifier } = await buildAuthUrl("login", state);

  const payload: OAuthState = { state, codeVerifier, flow: "login" };
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, Buffer.from(JSON.stringify(payload)).toString("base64url"), {
    httpOnly: true,
    secure: env().secureCookies,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return response;
}
