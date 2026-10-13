import Link from "next/link";
import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { requireCouple } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { countIdeas } from "@/server/ideas";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  const [ideaCount, calendars] = await Promise.all([countIdeas(coupleId), calendarStates(ctx)]);
  const calendarsReady = calendars.every((person) => person.state === "connected");

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <AppHeader user={user} partner={partner} />
      <p className="text-[17px] font-bold text-muted">Hey {user.name}!</p>

      <Card tone="minze" size="lg" className="animate-pop-in flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <Avatar person={user} size={64} className="animate-wiggle" />
          <span className="text-3xl" aria-hidden="true">
            💞
          </span>
          <Avatar person={partner} size={64} />
        </div>
        <h1 className="text-[32px] font-bold leading-tight">
          {user.name} &amp; {partner.name}
        </h1>
        <p className="font-bold">Ihr seid gekoppelt. Der Date-O-Mat gehört jetzt euch zwei.</p>
      </Card>

      {!calendarsReady && <ConnectCalendarCard people={calendars} next="/" />}

      <Link
        href="/ideas"
        className="press sticker flex items-center gap-4 rounded-[22px] bg-zitrone-soft px-4 py-3.5 text-tinte"
      >
        <span className="text-3xl" aria-hidden="true">
          💡
        </span>
        <span className="flex flex-col">
          <span className="font-display text-lg font-semibold">
            {ideaCount === 0 ? "Noch keine Ideen" : `${ideaCount} ${ideaCount === 1 ? "Idee" : "Ideen"} auf eurer Wunschliste`}
          </span>
          <span className="text-sm font-bold">
            {ideaCount === 0 ? "Tippt auf das gelbe + und schreibt die erste auf." : "Ansehen und ergänzen"}
          </span>
        </span>
      </Link>
    </div>
  );
}
