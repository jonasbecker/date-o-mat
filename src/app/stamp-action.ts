"use server";

import { getSessionUser } from "@/server/auth/session";
import { coupleStamp } from "@/server/stamp";

/** How long a page may show the same data at most: time moves on (countdowns, "heute", the calendars in Google). */
const MAX_AGE_MS = 5 * 60_000;

/** The couple's fingerprint for AutoRefresh (null when signed out); it also changes every 5 minutes. */
export async function stampAction(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return `${await coupleStamp(user.coupleId, user.id)}|${Math.floor(Date.now() / MAX_AGE_MS)}`;
}
