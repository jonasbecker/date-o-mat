"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireCouple } from "@/server/auth/dal";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/** End of the introduction (or "Überspringen"): never show it automatically again. */
export async function finishOnboardingAction(): Promise<void> {
  const { user } = await requireCouple();
  if (!user.onboardedAt) await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));
  // The browser may still hold "/ → /welcome" from before – drop it, or we would bounce back here.
  refresh();
  redirect("/");
}
