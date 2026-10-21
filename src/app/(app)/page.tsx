import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasSeenIntro, requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { getCoupleSettings } from "@/server/settings";

// No page of its own: the start page is "Date planen" – the next date on top, the flow below.
export default function HomePage() {
  return <Landing />;
}

async function Landing(): Promise<null> {
  const ctx = await requireCouple();
  if (!(await hasSeenIntro(ctx.user))) redirect("/welcome");
  await connection();
  // Rounds roll over on the first visit (like the tick does).
  await ensureCurrentCycle(ctx.coupleId, coupleNow(await getCoupleSettings(ctx.coupleId)));
  redirect("/plan");
}
