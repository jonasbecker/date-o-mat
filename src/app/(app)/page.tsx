import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { hasSeenIntro, requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { upcomingDate } from "@/server/dates";
import { dateToReview } from "@/server/reviews";
import { getCoupleSettings } from "@/server/settings";
import { landingPath } from "./overview";

// No page of its own: opening the app lands where something needs you –
// a date coming up or to rate → "Dates", otherwise → "Date planen".
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Landing />
    </Suspense>
  );
}

async function Landing(): Promise<null> {
  const ctx = await requireCouple();
  if (!(await hasSeenIntro(ctx.user))) redirect("/welcome");
  await connection();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  // Rounds roll over on the first visit (like the tick does).
  await ensureCurrentCycle(ctx.coupleId, now);
  const [nextDate, toReview] = await Promise.all([upcomingDate(ctx.coupleId, now), dateToReview(ctx, now)]);
  redirect(landingPath({ nextDate, toReview }));
}
