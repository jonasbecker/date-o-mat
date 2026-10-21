"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeInviteCode } from "@/lib/invite-code";
import { requireUser } from "@/server/auth/dal";
import { countMembers, createCouple, joinCouple, renewInviteCode, type JoinResult } from "@/server/couples";

export type JoinState = { error?: string; code?: string };

const JOIN_ERRORS: Record<Exclude<JoinResult, "ok">, string> = {
  invalid: "Diesen Code kennt Zweisamen nicht. Vielleicht ein Tippfehler?",
  own_code: "Das ist dein eigener Code – den schickst du deinem Schatz, der oder die tritt damit bei.",
  expired: "Der Code ist abgelaufen. Lass dir einen neuen schicken.",
  full: "Zu diesem Code gehören schon zwei. Zweisamen ist nur für ein Paar.",
  already_paired: "Du bist schon mit jemandem gekoppelt.",
};

export async function createCoupleAction() {
  const user = await requireUser();
  if (!user.coupleId) {
    await createCouple(user.id);
  }
  // The browser keeps visited pages a while (staleTimes): drop them, the next one shows the new state.
  refresh();
  redirect("/pair");
}

export async function renewInviteAction() {
  const user = await requireUser();
  if (user.coupleId && (await countMembers(user.coupleId)) < 2) {
    await renewInviteCode(user.coupleId);
  }
  refresh();
  redirect("/pair");
}

export async function joinCoupleAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const user = await requireUser();
  const input = String(formData.get("code") ?? "");
  const code = normalizeInviteCode(input);
  if (!code) {
    return { error: "Der Code hat 6 Zeichen, z. B. K7P-4QX.", code: input };
  }
  const result = await joinCouple(user.id, code);
  if (result !== "ok") {
    return { error: JOIN_ERRORS[result], code: input };
  }
  // Straight to the introduction (not via "/"), so the browser never caches "/" as a redirect.
  refresh();
  redirect(user.onboardedAt ? "/" : "/welcome");
}
