import "server-only";
import { eq } from "drizzle-orm";
import type { SlotRules } from "@/core/slots";
import type { EventMix, Extra, FlowerPot } from "@/lib/domain";
import type { SlotSettingsValues } from "@/lib/slot-settings";
import { db } from "@/server/db";
import { coupleSettings, cycles, datePhotos, type CoupleSettings } from "@/server/db/schema";
import { photoStore } from "@/server/photos/store";

/** The couple's settings; creates the default row if it is missing. */
export async function getCoupleSettings(coupleId: string): Promise<CoupleSettings> {
  const [settings] = await db.select().from(coupleSettings).where(eq(coupleSettings.coupleId, coupleId)).limit(1);
  if (settings) return settings;
  const [created] = await db.insert(coupleSettings).values({ coupleId }).onConflictDoNothing().returning();
  return created ?? (await getCoupleSettings(coupleId));
}

export async function updateSlotSettings(coupleId: string, values: SlotSettingsValues): Promise<void> {
  await getCoupleSettings(coupleId);
  await db.update(coupleSettings).set(values).where(eq(coupleSettings.coupleId, coupleId));
}

export function slotRulesFrom(settings: CoupleSettings): SlotRules {
  return {
    smallDurationMinutes: settings.smallDurationMinutes,
    smallStartFromMinute: settings.smallStartFromMinute,
    smallStartUntilMinute: settings.smallStartUntilMinute,
    largeMinDurationMinutes: settings.largeMinDurationMinutes,
    largeMaxDurationMinutes: settings.largeMaxDurationMinutes,
    largeStartFromMinute: settings.largeStartFromMinute,
    largeStartUntilMinute: settings.largeStartUntilMinute,
    latestEndMinute: settings.latestEndMinute,
    minLeadHours: settings.minLeadHours,
    bufferMinutes: settings.bufferMinutes,
  };
}

export type CycleSettingsValues = Pick<CoupleSettings, "rhythm" | "mode" | "deadlineDaysBeforeEnd">;

export async function updateCycleSettings(coupleId: string, values: CycleSettingsValues): Promise<void> {
  await getCoupleSettings(coupleId);
  await db.update(coupleSettings).set(values).where(eq(coupleSettings.coupleId, coupleId));
}

export async function setFirstPlanner(coupleId: string, userId: string): Promise<void> {
  await db.update(coupleSettings).set({ firstPlannerId: userId }).where(eq(coupleSettings.coupleId, coupleId));
}

/** The flower's name and pot (Setup → "Eure Blume heißt …"). */
export async function setFlower(coupleId: string, values: { flowerName?: string; flowerPot?: FlowerPot }): Promise<void> {
  await getCoupleSettings(coupleId);
  await db.update(coupleSettings).set(values).where(eq(coupleSettings.coupleId, coupleId));
}

export async function setDeckEventMix(coupleId: string, mix: EventMix): Promise<void> {
  await getCoupleSettings(coupleId);
  await db.update(coupleSettings).set({ deckEventMix: mix }).where(eq(coupleSettings.coupleId, coupleId));
}

export async function setExtraShown(coupleId: string, extra: Extra, shown: boolean): Promise<void> {
  const settings = await getCoupleSettings(coupleId);
  const hidden = new Set(settings.hiddenExtras);
  if (shown) hidden.delete(extra);
  else hidden.add(extra);
  await db.update(coupleSettings).set({ hiddenExtras: [...hidden] }).where(eq(coupleSettings.coupleId, coupleId));
}

/** Is this extra switched on for the couple? */
export function extraOn(settings: { hiddenExtras: readonly string[] }, extra: Extra): boolean {
  return !settings.hiddenExtras.includes(extra);
}

export async function setDevClockOffset(coupleId: string, minutes: number): Promise<void> {
  await db.update(coupleSettings).set({ devClockOffsetMinutes: minutes }).where(eq(coupleSettings.coupleId, coupleId));
}

/** Dev tools only: back to real time and start the rounds from scratch. */
export async function resetDevClock(coupleId: string): Promise<void> {
  // Test rounds take their dates (and those dates' photos) with them – remove the files too.
  const photos = await db.select({ full: datePhotos.fullPath, thumb: datePhotos.thumbPath }).from(datePhotos).where(eq(datePhotos.coupleId, coupleId));
  await photoStore()?.remove(photos.flatMap((p) => [p.full, p.thumb])).catch((error) => console.warn("[dev] removing photos failed", error));
  await db.delete(cycles).where(eq(cycles.coupleId, coupleId));
  await setDevClockOffset(coupleId, 0);
}
