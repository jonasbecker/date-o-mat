import "server-only";
import { env } from "@/server/env";
import type { CoupleSettings } from "@/server/db/schema";

/**
 * "Now" for a couple. With ENABLE_DEV_TOOLS=1 the dev clock offset from the
 * settings is added, so several rounds can be tested in a few minutes.
 */
export function coupleNow(settings: Pick<CoupleSettings, "devClockOffsetMinutes">): Date {
  const offset = env().devTools ? settings.devClockOffsetMinutes * 60_000 : 0;
  return new Date(Date.now() + offset);
}
