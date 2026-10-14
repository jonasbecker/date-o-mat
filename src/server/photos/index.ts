// Photos of a date: upload (already resized in the browser), list, delete.
import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { EXTENSION, sniffImageType } from "@/core/photos";
import { PHOTO_LIMITS } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { datePhotos, datePlans, type DatePhoto } from "@/server/db/schema";
import { photoStore } from "./store";

export type UploadResult = { ok: true; id: string } | { ok: false; error: "off" | "not_found" | "full" | "invalid" | "storage" };

export async function listPhotos(coupleId: string, dateId: string): Promise<DatePhoto[]> {
  return db
    .select()
    .from(datePhotos)
    .where(and(eq(datePhotos.coupleId, coupleId), eq(datePhotos.dateId, dateId)))
    .orderBy(asc(datePhotos.createdAt));
}

/** The first photo of each date – the cover on the "Unsere Dates" list. */
export async function coverPhotos(coupleId: string, dateIds: string[]): Promise<Map<string, string>> {
  if (dateIds.length === 0) return new Map();
  const rows = await db
    .select({ id: datePhotos.id, dateId: datePhotos.dateId })
    .from(datePhotos)
    .where(and(eq(datePhotos.coupleId, coupleId), inArray(datePhotos.dateId, dateIds)))
    .orderBy(asc(datePhotos.createdAt));
  const covers = new Map<string, string>();
  for (const row of rows) if (!covers.has(row.dateId)) covers.set(row.dateId, row.id);
  return covers;
}

export async function getPhoto(coupleId: string, photoId: string): Promise<DatePhoto | undefined> {
  const [photo] = await db
    .select()
    .from(datePhotos)
    .where(and(eq(datePhotos.id, photoId), eq(datePhotos.coupleId, coupleId)))
    .limit(1);
  return photo;
}

async function bytesOf(file: File): Promise<Uint8Array | null> {
  if (file.size === 0 || file.size > PHOTO_LIMITS.maxBytes) return null;
  return new Uint8Array(await file.arrayBuffer());
}

/** Stores the full image and its thumbnail for a date that already happened. */
export async function addPhoto(
  ctx: CoupleContext,
  input: { dateId: string; full: File; thumb: File; width: number; height: number },
): Promise<UploadResult> {
  const store = photoStore();
  if (!store) return { ok: false, error: "off" };
  const [date] = await db
    .select({ id: datePlans.id })
    .from(datePlans)
    .where(and(eq(datePlans.id, input.dateId), eq(datePlans.coupleId, ctx.coupleId), eq(datePlans.status, "done")))
    .limit(1);
  if (!date) return { ok: false, error: "not_found" };
  if ((await db.$count(datePhotos, eq(datePhotos.dateId, date.id))) >= PHOTO_LIMITS.perDate) return { ok: false, error: "full" };

  const [full, thumb] = await Promise.all([bytesOf(input.full), bytesOf(input.thumb)]);
  const fullType = full && sniffImageType(full);
  const thumbType = thumb && sniffImageType(thumb);
  const sizeOk = [input.width, input.height].every((n) => Number.isInteger(n) && n > 0 && n <= PHOTO_LIMITS.fullEdge);
  if (!full || !thumb || !fullType || !thumbType || !sizeOk) return { ok: false, error: "invalid" };

  // Random, unguessable names; the couple id keeps each couple's files apart.
  const id = randomUUID();
  const base = `couples/${ctx.coupleId}/dates/${date.id}/${id}`;
  const fullPath = `${base}.${EXTENSION[fullType]}`;
  const thumbPath = `${base}-thumb.${EXTENSION[thumbType]}`;
  try {
    await store.put(fullPath, full, fullType);
    await store.put(thumbPath, thumb, thumbType);
  } catch (error) {
    console.error("[photos] upload failed", error instanceof Error ? error.message : error);
    await store.remove([fullPath, thumbPath]).catch(() => {});
    return { ok: false, error: "storage" };
  }
  await db.insert(datePhotos).values({
    id,
    coupleId: ctx.coupleId,
    dateId: date.id,
    uploadedById: ctx.user.id,
    fullPath,
    thumbPath,
    width: input.width,
    height: input.height,
    bytes: full.byteLength + thumb.byteLength,
  });
  return { ok: true, id };
}

export async function deletePhoto(ctx: CoupleContext, photoId: string): Promise<boolean> {
  const photo = await getPhoto(ctx.coupleId, photoId);
  if (!photo) return false;
  await db.delete(datePhotos).where(eq(datePhotos.id, photo.id));
  try {
    await photoStore()?.remove([photo.fullPath, photo.thumbPath]);
  } catch (error) {
    console.warn("[photos] deleting files failed", error instanceof Error ? error.message : error);
  }
  return true;
}
