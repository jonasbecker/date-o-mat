import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/constants";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { db } from "@/server/db";
import { sessions, users, type User } from "@/server/db/schema";
import { env } from "@/server/env";

export type SessionCookie = {
  name: string;
  value: string;
  options: { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/"; expires: Date };
};

/** Stores a new session and returns the cookie the caller must set on its response. */
export async function createSession(userId: string, userAgent: string | null): Promise<SessionCookie> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: sha256Hex(token), userId, expiresAt, userAgent });
  return {
    name: SESSION_COOKIE,
    value: token,
    options: { httpOnly: true, secure: env().secureCookies, sameSite: "lax", path: "/", expires: expiresAt },
  };
}

/** The logged-in user, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256Hex(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  return row?.user ?? null;
});

/** Deletes the current session (server actions only – they may set cookies). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, sha256Hex(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}
