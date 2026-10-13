import { type NextRequest, NextResponse } from "next/server";
import { defaultBusyCalendarIds, missingCalendarScopes } from "@/core/calendars";
import { isEmailAllowed } from "@/lib/allowlist";
import { OAUTH_COOKIE } from "@/lib/constants";
import { exchangeCode, type GoogleIdentity, type GoogleTokens, type OAuthState } from "@/server/auth/google";
import { createSession, getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";
import { listCalendars } from "@/server/google/calendar-api";
import { getConnection, saveConnection, setBusyCalendars } from "@/server/google/connection";

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
  const saved = readOAuthState(request.cookies.get(OAUTH_COOKIE)?.value);
  // Calendar problems are explained on the settings page, login problems on the login page.
  const errorPage = saved?.flow === "calendar" ? "/settings?calendar=" : "/login?error=";

  if (params.get("error")) return finish(`${errorPage}cancelled`);
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) {
    return finish(`${errorPage}state`);
  }

  try {
    const { identity, tokens } = await exchangeCode(code, saved.codeVerifier);
    return saved.flow === "calendar"
      ? await connectCalendar(identity, tokens, saved.returnTo ?? "/settings")
      : await login(identity, request.headers.get("user-agent"));
  } catch (error) {
    console.error("[auth] Google callback failed", error);
    return finish(`${errorPage}oauth`);
  }
}

async function login(identity: GoogleIdentity, userAgent: string | null): Promise<NextResponse> {
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

  const session = await createSession(user.id, userAgent);
  const response = finish(user.coupleId ? "/" : "/pair");
  response.cookies.set(session.name, session.value, session.options);
  return response;
}

async function connectCalendar(identity: GoogleIdentity, tokens: GoogleTokens, returnTo: string): Promise<NextResponse> {
  const user = await getSessionUser();
  if (!user) return finish("/login");
  // The calendar must belong to the signed-in person, not to some other Google account.
  if (identity.sub !== user.googleSub) return finish("/settings?calendar=wrong_account");
  if (missingCalendarScopes(tokens.scope).length > 0) return finish("/settings?calendar=missing_scopes");
  if (!tokens.refreshToken) return finish("/settings?calendar=oauth");

  // Store first (so the API helper can use the token). On a first connection,
  // pick the default calendars; a reconnection keeps the earlier selection.
  const isNew = !(await getConnection(user.id));
  await saveConnection(user.id, tokens, ["primary"]);
  if (isNew) {
    try {
      await setBusyCalendars(user.id, defaultBusyCalendarIds(await listCalendars(user.id)));
    } catch (error) {
      console.warn("[google] could not read the calendar list – using the primary calendar only", error);
    }
  }
  return finish(`${returnTo}?calendar=connected`);
}
