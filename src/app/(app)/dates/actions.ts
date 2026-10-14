"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { parseReview } from "@/core/reviews";
import { requireCouple } from "@/server/auth/dal";
import { notifyPartnerReviewed } from "@/server/notifications";
import { pastDate, saveReview } from "@/server/reviews";

export type ReviewFormState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number };

export async function saveReviewAction(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(formData.get("dateId"));
  const input = parseReview({ rating: formData.get("rating"), note: formData.get("note") });
  if (!id.success) return { status: "error", message: "Dieses Date gibt es nicht mehr." };
  if (!input) return { status: "error", message: "Tipp auf 1 bis 5 Herzen." };

  const before = await pastDate(ctx.coupleId, id.data);
  if (!before || !(await saveReview(ctx, id.data, input))) {
    return { status: "error", message: "Dieses Date kann man (noch) nicht bewerten." };
  }
  // Only the first review is news for the partner – later edits are not.
  if (!before.reviews.some((r) => r.userId === ctx.user.id)) {
    const partnerDone = before.reviews.some((r) => r.userId === ctx.partner.id);
    after(() => notifyPartnerReviewed(ctx, before, partnerDone));
  }
  refresh();
  return { status: "saved", savedAt: Date.now() };
}
