import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { notHappenedAction, swapTurnAction } from "./actions";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { buttonClass } from "@/components/button";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { CycleHero, CycleHistory } from "@/components/cycle";
import { DateCard } from "@/components/date-card";
import { SparkleIcon } from "@/components/icons";
import { PushNudge } from "@/components/push-nudge";
import { SuggestionCard } from "@/components/suggestion-card";
import { countSubscriptions } from "@/server/push";
import { requireCouple } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { coupleNow } from "@/server/clock";
import { activeDateOf, cycleHistory, ensureCurrentCycle } from "@/server/cycles";
import { upcomingDate } from "@/server/dates";
import { countIdeas } from "@/server/ideas";
import { getCoupleSettings } from "@/server/settings";
import { currentSuggestion } from "@/server/suggestions";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const ctx = await requireCouple();
  // Time-based and writes the round state – only for real requests, not prefetches.
  await connection();
  const { user, partner, coupleId } = ctx;
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  const [ideaCount, calendars, history, nextDate, pushDevices] = await Promise.all([
    countIdeas(coupleId),
    calendarStates(ctx),
    cycleHistory(coupleId),
    upcomingDate(coupleId, now),
    countSubscriptions(user.id),
  ]);
  const roundDate = cycle?.status === "done" ? await activeDateOf(cycle.id) : undefined;
  const calendarsReady = calendars.every((person) => person.state === "connected");
  if (!cycle) return null;

  const isOpen = cycle.status === "open";
  const myTurn = cycle.mode === "alternating" && cycle.plannerId === user.id;
  const previous = history.at(-2);
  const suggestion = isOpen && cycle.mode === "suggestion" && calendarsReady ? await currentSuggestion(ctx, cycle, now) : null;

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <AppHeader user={user} partner={partner} />
      <p className="text-[17px] font-bold text-muted">Hey {user.name}!</p>

      <CycleHero cycle={cycle} me={user} partner={partner} now={now} />

      {nextDate && <DateCard date={nextDate} me={user} partner={partner} />}

      {roundDate?.status === "done" && (
        <form action={notHappenedAction.bind(null, roundDate.id)} className="-mt-2 self-center">
          <button type="submit" className="text-sm font-extrabold text-muted underline">
            „{roundDate.title}“ hat doch nicht geklappt?
          </button>
        </form>
      )}

      {isOpen && myTurn && (
        <div className="flex flex-col items-center gap-2">
          <Link href="/plan" className={buttonClass("primary", "lg", "w-full")}>
            <SparkleIcon />
            Date planen
          </Link>
          <form action={swapTurnAction}>
            <button type="submit" className="text-sm font-extrabold text-muted underline">
              Diese Runde an {partner.name} abgeben
            </button>
          </form>
        </div>
      )}

      {isOpen && cycle.mode === "alternating" && !myTurn && (
        <div className="flex flex-col gap-3 rounded-[22px] border-2 border-dashed border-line px-4 py-3.5">
          <p className="font-bold">
            {partner.name} plant diese Runde. Du kannst schon mal Ideen auf die Wunschliste setzen – oder einspringen.
          </p>
          <form action={swapTurnAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Ich übernehme diese Runde
            </button>
          </form>
        </div>
      )}

      {suggestion?.status === "ok" && <SuggestionCard suggestion={suggestion.suggestion} idea={suggestion.idea} />}
      {suggestion?.status === "no_slots" && (
        <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-3 font-bold">
          Diese Runde findet der Date-O-Mat keine gemeinsame Lücke mehr. Schaut unter „Planen“, ob ihr später Zeit habt.
        </p>
      )}

      {isOpen && previous?.status === "skipped" && (
        <div className="flex items-start gap-3 rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3.5 text-tinte">
          <span className="text-2xl leading-none" aria-hidden="true">
            🌦️
          </span>
          <p>
            <strong className="block font-extrabold">Runde {previous.seq} ist ausgefallen – passiert!</strong>
            <span className="font-semibold">Kein Stress. Diese Runde holt ihr&apos;s nach.</span>
          </p>
        </div>
      )}

      {!calendarsReady && <ConnectCalendarCard people={calendars} next="/" />}

      <PushNudge subscribed={pushDevices > 0} />

      <CycleHistory history={history} currentId={cycle.id} />

      <Link href="/ideas" className="press sticker flex items-center gap-4 rounded-[22px] bg-zitrone-soft px-4 py-3.5 text-tinte">
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
