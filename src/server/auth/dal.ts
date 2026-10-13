// Data Access Layer: every page and server action gets the current user
// through these helpers, so authorization is checked close to the data.
import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import { getSessionUser } from "./session";

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export type CoupleContext = {
  user: User;
  partner: User;
  coupleId: string;
};

/** The current user plus partner. Redirects to pairing while the couple is incomplete. */
export const requireCouple = cache(async (): Promise<CoupleContext> => {
  const user = await requireUser();
  if (!user.coupleId) redirect("/pair");
  const [partner] = await db
    .select()
    .from(users)
    .where(and(eq(users.coupleId, user.coupleId), ne(users.id, user.id)))
    .limit(1);
  if (!partner) redirect("/pair");
  return { user, partner, coupleId: user.coupleId };
});
