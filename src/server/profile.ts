// Per-person settings: start point for routes, key for the iPhone share shortcut.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, type User } from "@/server/db/schema";

export async function setStartLocation(userId: string, value: string | null): Promise<void> {
  const clean = value?.replace(/\s+/g, " ").trim().slice(0, 120) || null;
  await db.update(users).set({ startLocation: clean }).where(eq(users.id, userId));
}

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new key (shown once); an old one stops working. Only the hash is stored. */
export async function createShareKey(userId: string): Promise<string> {
  const key = `dom_${randomBytes(32).toString("base64url")}`;
  await db.update(users).set({ shareTokenHash: hash(key) }).where(eq(users.id, userId));
  return key;
}

export async function deleteShareKey(userId: string): Promise<void> {
  await db.update(users).set({ shareTokenHash: null }).where(eq(users.id, userId));
}

export async function userByShareKey(key: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.shareTokenHash, hash(key))).limit(1);
  return user;
}
