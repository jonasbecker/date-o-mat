"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { parseReview } from "@/core/reviews";
import { parseCost } from "@/lib/idea-input";
import { requireCouple } from "@/server/auth/dal";
import { setActualCost } from "@/server/budget";
import { notifyPartnerReviewed } from "@/server/notifications";
import { pastDate, saveReview } from "@/server/reviews";
import { addPhoto, deletePhoto } from "@/server/photos";

export type ReviewFormState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number };

export async function saveReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(formData.get("dateId"));
  const input = parseReview({ rating: formData.get("rating"), note: formData.get("note"), again: formData.get("again") });
  if (!id.success) return { status: "error", message: "Dieses Date gibt es nicht mehr." };
  if (!input) return { status: "error", message: "Tipp auf 1 bis 5 Herzen." };
  const cost = parseCost(String(formData.get("cost") ?? ""));
  if (Number.isNaN(cost) || (cost !== null && cost > 10_000)) return { status: "error", message: "Die Kosten bitte als Zahl, z. B. 25." };

  const before = await pastDate(ctx.coupleId, id.data);
  if (!before || !(await saveReview(ctx, id.data, input))) {
    return { status: "error", message: "Dieses Date kann man (noch) nicht bewerten." };
  }
  const costChanged = String(formData.get("cost") ?? "").trim() !== String(formData.get("costBefore") ?? "").trim();
  if (formData.has("cost") && costChanged) await setActualCost(ctx.coupleId, id.data, cost);
  // Only the first review is news for the partner – later edits are not.
  if (!before.reviews.some((r) => r.userId === ctx.user.id)) {
    const partnerDone = before.reviews.some((r) => r.userId === ctx.partner.id);
    after(() => notifyPartnerReviewed(ctx, before, partnerDone));
  }
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

const PHOTO_ERRORS = {
  off: "Fotos sind auf dem Server noch nicht eingerichtet.",
  not_found: "Dieses Date gibt es nicht (mehr).",
  full: "Mehr Fotos passen zu diesem Date nicht.",
  invalid: "Dieses Bild konnte nicht gelesen werden.",
  storage: "Der Foto-Speicher hakt gerade. Versuch es gleich nochmal.",
} as const;

/** One photo per call (full + thumbnail, both resized in the browser). */
export async function uploadPhotoAction(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireCouple();
  const dateId = z.uuid().safeParse(formData.get("dateId"));
  const full = formData.get("full");
  const thumb = formData.get("thumb");
  if (!dateId.success || !(full instanceof File) || !(thumb instanceof File)) return { ok: false, message: PHOTO_ERRORS.invalid };
  const result = await addPhoto(ctx, {
    dateId: dateId.data,
    full,
    thumb,
    width: Number(formData.get("width")),
    height: Number(formData.get("height")),
  });
  if (result.ok) refresh();
  return result.ok ? { ok: true } : { ok: false, message: PHOTO_ERRORS[result.error] };
}

export async function deletePhotoAction(photoId: string): Promise<void> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(photoId);
  if (id.success) await deletePhoto(ctx, id.data);
  refresh();
}
