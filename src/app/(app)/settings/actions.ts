"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PLAN_MODES, RHYTHMS } from "@/lib/domain";
import { parseSlotSettings, type SlotSettingsErrors } from "@/lib/slot-settings";
import { requireCouple } from "@/server/auth/dal";
import { destroySession } from "@/server/auth/session";
import { listCalendars } from "@/server/google/calendar-api";
import { disconnect, setBusyCalendars } from "@/server/google/connection";
import { coupleNow } from "@/server/clock";
import { applySettingsToOpenCycle } from "@/server/cycles";
import { env } from "@/server/env";
import { getCoupleSettings, resetDevClock, setDevClockOffset, updateCycleSettings, updateSlotSettings } from "@/server/settings";
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
