"use server";

import { getSessionUser } from "@/server/auth/session";
import { badgeForUser } from "@/server/badge";

/** The number for the app icon (null: signed out or not paired yet). Asked after the page is there, never while it renders. */
export async function badgeAction(): Promise<number | null> {
  const user = await getSessionUser();
  return user ? badgeForUser(user.id) : null;
}
