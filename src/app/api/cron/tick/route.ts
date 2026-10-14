import { timingSafeEqual } from "node:crypto";
import { after, type NextRequest, NextResponse } from "next/server";
import { env } from "@/server/env";
import { recordTick } from "@/server/system-status";
import { runDeckRefill, runEventRefresh, runTick } from "@/server/tick";

// Reading an event source (page + Claude) can take a while; it runs after the answer.
export const maxDuration = 120;

function authorized(request: NextRequest): boolean {
  const secret = env().cronSecret;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(request: NextRequest) {
  if (!env().cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runTick();
  await recordTick(result, new Date());
  after(async () => {
    await runEventRefresh();
    await runDeckRefill();
  });
  return NextResponse.json({ ok: result.errors === 0, ...result });
}

// cron-job.org can use either method.
export const GET = handle;
export const POST = handle;
