import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/server/env";
import { runTick } from "@/server/tick";

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
  return NextResponse.json({ ok: result.errors === 0, ...result });
}

// cron-job.org can use either method.
export const GET = handle;
export const POST = handle;
