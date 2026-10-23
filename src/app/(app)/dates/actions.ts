"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { parseReview } from "@/core/reviews";
import { redirect } from "next/navigation";
import { NOTE_MAX } from "@/core/archive";
import { WILT_REASONS } from "@/lib/domain";
import { parseCost } from "@/lib/idea-input";
import { setActualCost } from "@/server/budget";
import { requireCouple } from "@/server/auth/dal";
import { ideaForDate, ideaForWilt, removeWiltLeaf, setWilt } from "@/server/archive";
import { notifyPartnerReviewed } from "@/server/notifications";
import { pastDate, saveReview } from "@/server/reviews";
import { addPhoto, deletePhoto } from "@/server/photos";

export type ReviewFormState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number };

/** "wie war's?" (ARCHIV.md §3): "nochmal?" and a sentence for later; the leaf grows from the first save. */
export async function saveReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(formData.get("dateId"));
  const note = String(formData.get("note") ?? "").slice(0, NOTE_MAX);
  if (!id.success) return { status: "error", message: "Dieses Date gibt es nicht mehr." };
  const before = await pastDate(ctx.coupleId, id.data);
  if (!before) return { status: "error", message: "Dieses Date kann man (noch) nicht festhalten." };
  // Old hearts stay as they were.
  const mine = before.reviews.find((r) => r.userId === ctx.user.id);
  const input = parseReview({ rating: mine?.rating ?? null, note, again: formData.get("again") });
  if (!input) return { status: "error", message: "Erst wählen: nochmal?" };
  // What it really cost (for the budget) – prefilled with the estimate.
  const cost = parseCost(String(formData.get("cost") ?? ""));
  if (Number.isNaN(cost) || (cost !== null && cost > 10_000)) return { status: "error", message: "Die Kosten bitte als Zahl, z. B. 25." };
  if (!(await saveReview(ctx, id.data, input))) return { status: "error", message: "Dieses Date kann man (noch) nicht festhalten." };
  const costChanged = String(formData.get("cost") ?? "").trim() !== String(formData.get("costBefore") ?? "").trim();
  if (formData.has("cost") && costChanged) await setActualCost(ctx.coupleId, id.data, cost);
  // Only the first answer is news for the partner – later edits are not.
  if (!mine) {
    const partnerDone = before.reviews.some((r) => r.userId === ctx.partner.id);
    after(() => notifyPartnerReviewed(ctx, before, partnerDone));
  }
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** "Nochmal pflanzen": the date's idea goes into the planning flow (back on the wishlist if it had left it). */
export async function replantAction(dateId: string): Promise<void> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(dateId);
  const ideaId = id.success ? await ideaForDate(ctx, id.data) : null;
  refresh();
  redirect(ideaId ? `/plan?idea=${ideaId}` : "/plan?pick=1");
}

/** A wilted leaf: why it fell through (a chip) and a note. */
export async function setWiltAction(cycleId: string, reason: string | null, note: string | null): Promise<void> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(cycleId);
  if (!id.success) return;
  await setWilt(ctx, id.data, WILT_REASONS.find((r) => r === reason) ?? null, note?.trim().slice(0, NOTE_MAX) || null);
  refresh();
}

/** "Neuen Termin finden" (to the planning flow with its idea) or "Zurück ins Regal legen" (the idea back on the wishlist). */
export async function wiltIdeaAction(cycleId: string, to: "plan" | "shelf"): Promise<void> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(cycleId);
  const ideaId = id.success ? await ideaForWilt(ctx, id.data) : null;
  refresh();
  if (to === "plan") redirect(ideaId ? `/plan?idea=${ideaId}` : "/plan?pick=1");
  redirect(ideaId ? `/ideas?ansicht=alle&idee=${ideaId}` : "/ideas");
}

/** "Blatt entfernen" (after a question): the wilted leaf leaves the stem; the round itself stays. */
export async function removeLeafAction(cycleId: string): Promise<void> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(cycleId);
  if (id.success) await removeWiltLeaf(ctx, id.data);
  refresh();
  redirect("/dates");
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
