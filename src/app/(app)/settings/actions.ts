"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isPushEndpointAllowed } from "@/lib/allowlist";
import { EVENT_MIXES, EXTRAS, FLOWER_NAME_MAX, FLOWER_POTS, NOTIFICATION_TYPES, PLAN_MODES, RHYTHMS } from "@/lib/domain";
import { unlockedPots } from "@/core/bloom";
import { countDoneDates } from "@/server/dates";
import { parseSlotSettings, type SlotSettingsErrors } from "@/lib/slot-settings";
import { parseBudget } from "@/core/budget";
import { parseSpecialDay } from "@/core/special-days";
import { addSpecialDay, deleteSpecialDay } from "@/server/special-days";
import { requireCouple } from "@/server/auth/dal";
import { setBudget } from "@/server/budget";
import { createShareKey, deleteShareKey, setStartLocation } from "@/server/profile";
import { destroySession } from "@/server/auth/session";
import { listCalendars } from "@/server/google/calendar-api";
import { disconnect, setBusyCalendars } from "@/server/google/connection";
import { coupleNow } from "@/server/clock";
import { applySettingsToOpenCycle } from "@/server/cycles";
import { env } from "@/server/env";
import { getCoupleSettings, resetDevClock, setDeckEventMix, setDevClockOffset, setExtraShown, setFlower, updateCycleSettings, updateSlotSettings } from "@/server/settings";
import { removeSubscription, saveSubscription, sendToUser, setPref } from "@/server/push";
import { tickCouple } from "@/server/tick";

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function saveBusyCalendarsAction(formData: FormData) {
  const { user } = await requireCouple();
  const chosen = new Set(formData.getAll("calendarId").map(String));
  // Only accept calendars that really are in the person's Google calendar list.
  const known = await listCalendars(user.id);
  const ids = known.filter((c) => !c.primary && chosen.has(c.id)).map((c) => c.id);
  await setBusyCalendars(user.id, ["primary", ...ids]);
  redirect("/settings?calendar=saved");
}

export async function disconnectCalendarAction() {
  const { user } = await requireCouple();
  await disconnect(user.id);
  redirect("/settings?calendar=disconnected");
}

export type SlotSettingsState = {
  status: "idle" | "saved" | "error";
  errors?: SlotSettingsErrors;
  /** Submitted raw values, so the form can show them again after an error. */
  values?: Record<string, string>;
  savedAt?: number;
};

export async function saveSlotSettingsAction(_prev: SlotSettingsState, formData: FormData): Promise<SlotSettingsState> {
  const { coupleId } = await requireCouple();
  const values = Object.fromEntries([...formData].map(([key, value]) => [key, String(value)]));
  const parsed = parseSlotSettings(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, values };
  await updateSlotSettings(coupleId, parsed.data);
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export type CycleSettingsState = { status: "idle" | "saved" | "error"; savedAt?: number };

const cycleSettingsSchema = z.object({
  rhythm: z.enum(RHYTHMS),
  mode: z.enum(PLAN_MODES),
  deadlineDaysBeforeEnd: z.coerce.number().int().min(0).max(10),
});

export async function saveCycleSettingsAction(_prev: CycleSettingsState, formData: FormData): Promise<CycleSettingsState> {
  const { coupleId } = await requireCouple();
  const parsed = cycleSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error" };
  await updateCycleSettings(coupleId, parsed.data);
  // An open round follows the new mode and deadline right away; the rhythm applies from the next one.
  await applySettingsToOpenCycle(coupleId, coupleNow(await getCoupleSettings(coupleId)));
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** Dev tools (ENABLE_DEV_TOOLS=1 only): move the couple's clock and run the tick. */
export async function devClockAction(formData: FormData) {
  const { coupleId } = await requireCouple();
  if (!env().devTools) return;
  if (formData.get("reset")) {
    await resetDevClock(coupleId);
  } else {
    const settings = await getCoupleSettings(coupleId);
    const step = Number(formData.get("minutes"));
    await setDevClockOffset(coupleId, settings.devClockOffsetMinutes + (Number.isFinite(step) ? step : 0));
  }
  await tickCouple(coupleId);
  refresh();
}

// --- Push ---------------------------------------------------------------------------

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpointAllowed),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export async function savePushSubscriptionAction(subscription: unknown, userAgent: string): Promise<{ ok: boolean }> {
  const { user } = await requireCouple();
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false };
  await saveSubscription(user.id, parsed.data, typeof userAgent === "string" ? userAgent.slice(0, 300) : null);
  refresh();
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<void> {
  const { user } = await requireCouple();
  if (typeof endpoint !== "string") return;
  await removeSubscription(user.id, endpoint);
  refresh();
}

export async function setNotificationPrefAction(type: string, enabled: boolean): Promise<void> {
  const { user } = await requireCouple();
  const parsed = z.enum(NOTIFICATION_TYPES).safeParse(type);
  if (parsed.success) await setPref(user.id, parsed.data, enabled);
  refresh();
}

export async function sendTestPushAction(): Promise<{ delivered: number }> {
  const { user } = await requireCouple();
  const delivered = await sendToUser(
    user.id,
    { title: "Hallo von Zweisamen 👋", body: "So sehen eure Erinnerungen aus.", url: "/", tag: "test" },
    "test",
  );
  return { delivered };
}

/** How many event combos the swipe deck mixes in (affects the next batch). */
export async function setEventMixAction(mix: string): Promise<void> {
  const { coupleId } = await requireCouple();
  const parsed = z.enum(EVENT_MIXES).safeParse(mix);
  if (!parsed.success) return;
  await setDeckEventMix(coupleId, parsed.data);
  refresh();
}

/** "Eure Blume heißt …": a new name (1–20 characters). */
export async function renameFlowerAction(name: string): Promise<{ ok: boolean }> {
  const { coupleId } = await requireCouple();
  const parsed = z.string().trim().min(1).max(FLOWER_NAME_MAX).safeParse(name);
  if (!parsed.success) return { ok: false };
  await setFlower(coupleId, { flowerName: parsed.data });
  refresh();
  return { ok: true };
}

/** A pot for the flower – only one you have unlocked with your lived dates. */
export async function choosePotAction(pot: string): Promise<{ ok: boolean }> {
  const { coupleId } = await requireCouple();
  const parsed = z.enum(FLOWER_POTS).safeParse(pot);
  if (!parsed.success) return { ok: false };
  if (!unlockedPots(await countDoneDates(coupleId)).includes(parsed.data)) return { ok: false };
  await setFlower(coupleId, { flowerPot: parsed.data });
  refresh();
  return { ok: true };
}

export async function setExtraAction(extra: string, shown: boolean): Promise<void> {
  const { coupleId } = await requireCouple();
  const parsed = z.enum(EXTRAS).safeParse(extra);
  if (!parsed.success) return;
  await setExtraShown(coupleId, parsed.data, shown === true);
  refresh();
}

export type BudgetFormState = { status: "idle" | "saved" | "error"; message?: string };

/** Monthly date budget in euros; empty = no budget. */
export async function setBudgetAction(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const { coupleId } = await requireCouple();
  const budget = parseBudget(String(formData.get("budget") ?? ""));
  if (Number.isNaN(budget)) return { status: "error", message: "Bitte einen Betrag zwischen 1 und 10.000 € – oder leer lassen für kein Budget." };
  await setBudget(coupleId, budget, coupleNow(await getCoupleSettings(coupleId)));
  refresh();
  return { status: "saved" };
}

export type SpecialDayFormState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number };

export async function addSpecialDayAction(_prev: SpecialDayFormState, formData: FormData): Promise<SpecialDayFormState> {
  const ctx = await requireCouple();
  const parsed = parseSpecialDay({ kind: formData.get("kind"), title: formData.get("title"), date: formData.get("date") }, [ctx.user.id, ctx.partner.id]);
  if ("error" in parsed) return { status: "error", message: parsed.error };
  if (!(await addSpecialDay(ctx, parsed))) return { status: "error", message: "Mehr besondere Tage passen nicht rein." };
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

export async function deleteSpecialDayAction(id: string): Promise<void> {
  const { coupleId } = await requireCouple();
  if (z.uuid().safeParse(id).success) await deleteSpecialDay(coupleId, id);
  refresh();
}

export type StartLocationState = { status: "idle" | "saved" };

export async function saveStartLocationAction(_prev: StartLocationState, formData: FormData): Promise<StartLocationState> {
  const { user } = await requireCouple();
  await setStartLocation(user.id, String(formData.get("startLocation") ?? ""));
  refresh();
  return { status: "saved" };
}

/** A new key for the iPhone share shortcut – shown exactly once. */
export async function createShareKeyAction(): Promise<{ key: string }> {
  const { user } = await requireCouple();
  const key = await createShareKey(user.id);
  return { key };
}

export async function deleteShareKeyAction(): Promise<void> {
  const { user } = await requireCouple();
  await deleteShareKey(user.id);
  refresh();
}
