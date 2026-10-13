import "server-only";
import { eq } from "drizzle-orm";
import type { SlotRules } from "@/core/slots";
import type { SlotSettingsValues } from "@/lib/slot-settings";
import { db } from "@/server/db";
import { coupleSettings, type CoupleSettings } from "@/server/db/schema";

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
