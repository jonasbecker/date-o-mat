"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { isSurpriseHidden } from "@/core/date-extras";
import { parseIdeaInput, type IdeaFieldErrors } from "@/lib/idea-input";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { swapDateIdea } from "@/server/dates";
import { archiveIdea, createIdea, updateIdea } from "@/server/ideas";
import { notifyPartner } from "@/server/notifications";
import { getCoupleSettings } from "@/server/settings";

export type IdeaFormState = {
  status: "idle" | "saved" | "error";
  errors?: IdeaFieldErrors;
  message?: string;
  /** Submitted raw values, so the form can show them again after an error. */
  values?: Record<string, string>;
  /** Changes on every successful save – lets the client react exactly once. */
  savedAt?: number;
};

const FIELDS = ["title", "size", "note", "url", "costEur", "location", "setting", "category"] as const;

function readValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(FIELDS.map((field) => [field, String(formData.get(field) ?? "")]));
}

export async function createIdeaAction(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const { user, coupleId } = await requireCouple();
  const values = readValues(formData);
  const parsed = parseIdeaInput(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };

  await createIdea(coupleId, user.id, parsed.data);
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

const ideaId = z.uuid();

export async function updateIdeaAction(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const { user, coupleId } = await requireCouple();
  const values = readValues(formData);
  const id = ideaId.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Diese Idee gibt es nicht mehr.", values };

  const parsed = parseIdeaInput(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };

  const ok = await updateIdea(coupleId, user.id, id.data, parsed.data);
  if (!ok) return { status: "error", message: "Diese Idee gibt es nicht mehr.", values };
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function archiveIdeaAction(id: string): Promise<void> {
  const { user, coupleId } = await requireCouple();
  const parsed = ideaId.safeParse(id);
  if (parsed.success) {
    await archiveIdea(coupleId, user.id, parsed.data);
  }
  refresh();
}


/** "Statt „X“ lieber diese Idee": the next date keeps its time and gets this idea. */
export async function swapDateIdeaAction(dateId: string, id: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireCouple();
  const parsedDate = ideaId.safeParse(dateId);
  const parsedIdea = ideaId.safeParse(id);
  if (!parsedDate.success || !parsedIdea.success) return { ok: false, message: "Das Date gibt es so nicht mehr – schau auf der Startseite." };
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const result = await swapDateIdea(ctx, parsedDate.data, parsedIdea.data, now);
  if (!result.ok) {
    const messages = {
      invalid: "Das Date gibt es so nicht mehr – schau auf der Startseite.",
      surprise: `Das ist eine Überraschung – die kann nur ${ctx.partner.name} ändern.`,
      same: "Das macht ihr schon.",
    };
    return { ok: false, message: messages[result.error] };
  }
  // A surprise stays quiet – the partner only knows the time anyway.
  if (!isSurpriseHidden(result.date, ctx.partner.id, now)) after(() => notifyPartner(ctx, "changed", result.date));
  refresh();
  return { ok: true };
}
