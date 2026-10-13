"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { parseSlotSettings, type SlotSettingsErrors } from "@/lib/slot-settings";
import { requireCouple } from "@/server/auth/dal";
import { destroySession } from "@/server/auth/session";
import { listCalendars } from "@/server/google/calendar-api";
import { disconnect, setBusyCalendars } from "@/server/google/connection";
import { updateSlotSettings } from "@/server/settings";

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
