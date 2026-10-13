// Stores the Google tokens of a user (encrypted) and hands out fresh access tokens.
import "server-only";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/crypto";
import type { GoogleTokens } from "@/server/auth/google";
import { oauthClient } from "@/server/auth/google";
import { db } from "@/server/db";
import { googleConnections } from "@/server/db/schema";
import { env } from "@/server/env";

export type GoogleConnection = typeof googleConnections.$inferSelect;

/** The user has no usable calendar connection (never connected, or Google revoked it). */
export class CalendarNotConnectedError extends Error {
  constructor(
    readonly userId: string,
    readonly reason: "missing" | "reauth",
  ) {
    super(`Calendar of user ${userId} is not connected (${reason})`);
  }
}

const REFRESH_MARGIN_MS = 60_000;

export async function getConnection(userId: string): Promise<GoogleConnection | undefined> {
  const [connection] = await db.select().from(googleConnections).where(eq(googleConnections.userId, userId)).limit(1);
  return connection;
}

export async function saveConnection(userId: string, tokens: GoogleTokens, busyCalendarIds: string[]): Promise<void> {
  if (!tokens.refreshToken) throw new Error("No refresh token to store");
  const key = env().tokenKey;
  const values = {
    refreshTokenEnc: encrypt(tokens.refreshToken, key),
    accessTokenEnc: tokens.accessToken ? encrypt(tokens.accessToken, key) : null,
    accessTokenExpiresAt: tokens.expiresAt,
    scopes: tokens.scope.split(/\s+/).filter(Boolean),
    status: "ok" as const,
  };
  await db
    .insert(googleConnections)
    .values({ userId, ...values, busyCalendarIds })
    .onConflictDoUpdate({ target: googleConnections.userId, set: { ...values, connectedAt: new Date() } });
}

export async function setBusyCalendars(userId: string, calendarIds: string[]): Promise<void> {
  await db.update(googleConnections).set({ busyCalendarIds: calendarIds }).where(eq(googleConnections.userId, userId));
}

function isInvalidGrant(error: unknown): boolean {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error === "invalid_grant" || (error instanceof Error && error.message.includes("invalid_grant"));
}

/**
 * Returns a valid access token, refreshing it with the stored refresh token
 * when it expires within a minute. If Google rejects the refresh token
 * (revoked, password change, …) the connection is flagged for reconnection.
 */
export async function getAccessToken(userId: string, { forceRefresh = false } = {}): Promise<string> {
  const connection = await getConnection(userId);
  if (!connection) throw new CalendarNotConnectedError(userId, "missing");
  if (connection.status === "needs_reauth") throw new CalendarNotConnectedError(userId, "reauth");

  const key = env().tokenKey;
  const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
  if (!forceRefresh && connection.accessTokenEnc && expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return decrypt(connection.accessTokenEnc, key);
  }

  const client = oauthClient();
  client.setCredentials({ refresh_token: decrypt(connection.refreshTokenEnc, key) });
  try {
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("Google returned no access token");
    const credentials = client.credentials;
    await db
      .update(googleConnections)
      .set({
        accessTokenEnc: encrypt(token, key),
        accessTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        // Google may rotate the refresh token; keep the newest one.
        ...(credentials.refresh_token ? { refreshTokenEnc: encrypt(credentials.refresh_token, key) } : {}),
      })
      .where(eq(googleConnections.userId, userId));
    return token;
  } catch (error) {
    if (isInvalidGrant(error)) {
      await markNeedsReauth(userId);
      throw new CalendarNotConnectedError(userId, "reauth");
    }
    throw error;
  }
}

export async function markNeedsReauth(userId: string): Promise<void> {
  await db.update(googleConnections).set({ status: "needs_reauth" }).where(eq(googleConnections.userId, userId));
}

/** Revokes the grant at Google (best effort) and forgets the tokens. */
export async function disconnect(userId: string): Promise<void> {
  const connection = await getConnection(userId);
  if (!connection) return;
  try {
    const token = decrypt(connection.refreshTokenEnc, env().tokenKey);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.warn("[google] revoking the token failed – deleting it locally anyway", error);
  }
  await db.delete(googleConnections).where(eq(googleConnections.userId, userId));
}
