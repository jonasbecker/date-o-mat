"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { deviceLabel } from "@/core/device";
import { getSessionUser } from "@/server/auth/session";
import { recordError } from "@/server/server-errors";

const Report = z.object({ message: z.string().min(1).max(500), path: z.string().max(200).nullable() });

/** An error in the app on a phone (components/error-reporter.tsx): counted for the status – only when signed in. */
export async function reportClientErrorAction(input: { message: string; path: string | null }): Promise<void> {
  const report = Report.safeParse(input);
  if (!report.success || !(await getSessionUser())) return;
  const device = deviceLabel((await headers()).get("user-agent"));
  await recordError("client", { ...report.data, device });
}
