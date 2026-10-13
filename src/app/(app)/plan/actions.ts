"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { IDEA_SIZES } from "@/lib/domain";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { DATE_ERROR_MESSAGES } from "@/lib/date-errors";
import { saveDate } from "@/server/dates";
import { getCoupleSettings } from "@/server/settings";

export type SaveDateState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number };

const optionalUuid = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.uuid().optional());
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(120).optional());

const schema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  size: z.enum(IDEA_SIZES),
  ideaId: optionalUuid,
  customTitle: optionalText,
  customLocation: optionalText,
  dateId: optionalUuid,
});

/** "Date festlegen" (or "Termin ändern" with a dateId). */
export async function saveDateAction(_prev: SaveDateState, formData: FormData): Promise<SaveDateState> {
  const ctx = await requireCouple();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || (!parsed.data.ideaId && !parsed.data.customTitle)) {
    return { status: "error", message: parsed.success ? "Wähl eine Idee oder schreib eine spontane auf." : DATE_ERROR_MESSAGES.invalid };
  }
  const data = parsed.data;
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const result = await saveDate(
    ctx,
    {
      start: new Date(data.start),
      end: new Date(data.end),
      size: data.size,
      ideaId: data.ideaId ?? null,
      customTitle: data.ideaId ? null : (data.customTitle ?? null),
      customLocation: data.ideaId ? null : (data.customLocation ?? null),
    },
    now,
    data.dateId,
  );
  if (!result.ok) return { status: "error", message: DATE_ERROR_MESSAGES[result.error] };
  refresh();
  return { status: "saved", savedAt: Date.now() };
}
