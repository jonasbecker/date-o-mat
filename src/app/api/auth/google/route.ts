import { type NextRequest, NextResponse } from "next/server";
import { OAUTH_COOKIE } from "@/lib/constants";
import { randomToken } from "@/lib/crypto";
import { buildAuthUrl, RETURN_PATHS, type OAuthState, type ReturnPath } from "@/server/auth/google";
import { getSessionUser } from "@/server/auth/session";
import { env } from "@/server/env";

// Starts a Google OAuth round trip:
//   /api/auth/google                          → sign in
//   /api/auth/google?flow=calendar&next=/plan → connect the calendar (signed in only)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const flow = params.get("flow") === "calendar" ? "calendar" : "login";
  const next = params.get("next");
  const returnTo = RETURN_PATHS.find((path) => path === next) ?? ("/settings" satisfies ReturnPath);

  let loginHint: string | undefined;
  if (flow === "calendar") {
    const user = await getSessionUser();
    if (!user) return NextResponse.redirect(new URL("/login", env().appUrl));
    loginHint = user.email;
  }

  const state = randomToken(16);
  const { url, codeVerifier } = await buildAuthUrl(flow, state, loginHint);
  const payload: OAuthState = { state, codeVerifier, flow, ...(flow === "calendar" ? { returnTo } : {}) };

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
