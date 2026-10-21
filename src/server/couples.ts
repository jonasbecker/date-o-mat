import "server-only";
import { eq } from "drizzle-orm";
import { INVITE_VALID_HOURS } from "@/lib/constants";
import { generateInviteCode } from "@/lib/invite-code";
import { db } from "@/server/db";
import { coupleSettings, couples, users, type Couple } from "@/server/db/schema";

function inviteExpiry(): Date {
  return new Date(Date.now() + INVITE_VALID_HOURS * 60 * 60 * 1000);
}

function isUniqueViolation(error: unknown): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

/** Starts a new couple with the given user as first member (and first planner). */
export async function createCouple(userId: string): Promise<Couple> {
  // A collision of two 6-character codes is very unlikely; retry a few times anyway.
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [couple] = await tx
          .insert(couples)
          .values({ inviteCode: generateInviteCode(), inviteExpiresAt: inviteExpiry() })
          .returning();
        await tx.update(users).set({ coupleId: couple.id, color: "mandarine" }).where(eq(users.id, userId));
        await tx.insert(coupleSettings).values({ coupleId: couple.id, firstPlannerId: userId });
        return couple;
      });
    } catch (error) {
      if (attempt < 3 && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}

/** Issues a fresh invite code for a couple that still waits for its second member. */
export async function renewInviteCode(coupleId: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await db
        .update(couples)
        .set({ inviteCode: generateInviteCode(), inviteExpiresAt: inviteExpiry() })
        .where(eq(couples.id, coupleId));
      return;
    } catch (error) {
      if (attempt < 3 && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}

export type JoinResult = "ok" | "invalid" | "own_code" | "expired" | "full" | "already_paired";

/**
 * Adds the user to the couple behind `code`. Once two people are in, the code is
 * deleted, so nobody else can ever join. If the user had started a couple of
 * their own that nobody joined yet, that empty couple is dropped.
 */
export async function joinCouple(userId: string, code: string): Promise<JoinResult> {
  return db.transaction(async (tx) => {
    const [couple] = await tx.select().from(couples).where(eq(couples.inviteCode, code)).for("update").limit(1);
    if (!couple) return "invalid";
    if (!couple.inviteExpiresAt || couple.inviteExpiresAt < new Date()) return "expired";

    const members = await tx.select({ id: users.id }).from(users).where(eq(users.coupleId, couple.id));
    if (members.length >= 2) return "full";
    if (members.some((member) => member.id === userId)) return "own_code";

    const [me] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
    if (me.coupleId) {
      const ownMembers = await tx.select({ id: users.id }).from(users).where(eq(users.coupleId, me.coupleId));
      if (ownMembers.length > 1) return "already_paired";
      await tx.update(users).set({ coupleId: null }).where(eq(users.id, userId));
      await tx.delete(couples).where(eq(couples.id, me.coupleId));
    }

    await tx.update(users).set({ coupleId: couple.id, color: "himmel" }).where(eq(users.id, userId));
    await tx.update(couples).set({ inviteCode: null, inviteExpiresAt: null }).where(eq(couples.id, couple.id));
    return "ok";
  });
}

export async function getCouple(coupleId: string): Promise<Couple | undefined> {
  const [couple] = await db.select().from(couples).where(eq(couples.id, coupleId)).limit(1);
  return couple;
}

export async function countMembers(coupleId: string): Promise<number> {
  return db.$count(users, eq(users.coupleId, coupleId));
}
