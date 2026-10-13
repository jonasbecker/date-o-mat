import { type NextRequest, NextResponse } from "next/server";
import { isEmailAllowed } from "@/lib/allowlist";
import { OAUTH_COOKIE } from "@/lib/constants";
import { exchangeCode, type OAuthState } from "@/server/auth/google";
import { createSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";

function readOAuthState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
}

function finish(path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, env().appUrl));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/google" });
  return response;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish("/login?error=cancelled");

  const saved = readOAuthState(request.cookies.get(OAUTH_COOKIE)?.value);
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) {
    return finish("/login?error=state");
  }

  try {
    const identity = await exchangeCode(code, saved.codeVerifier);
    if (!isEmailAllowed(identity.email, env().allowedEmails)) {
      console.warn(`[auth] login rejected for ${identity.email} (not in ALLOWED_EMAILS)`);
      return finish("/login?error=not_allowed");
    }

    const [user] = await db
      .insert(users)
      .values({
        googleSub: identity.sub,
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.googleSub,
        set: { email: identity.email, name: identity.name, avatarUrl: identity.avatarUrl, lastLoginAt: new Date() },
      })
      .returning();

    const session = await createSession(user.id, request.headers.get("user-agent"));
    const response = finish(user.coupleId ? "/" : "/pair");
    response.cookies.set(session.name, session.value, session.options);
    return response;
  } catch (error) {
    console.error("[auth] Google callback failed", error);
    return finish("/login?error=oauth");
  }
}
