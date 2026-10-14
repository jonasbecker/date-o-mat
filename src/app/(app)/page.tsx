import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { notHappenedAction } from "./actions";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { CycleHistory } from "@/components/cycle";
import { DateCard } from "@/components/date-card";
import { NextStepCard } from "@/components/next-step";
import { SetupChecklist } from "@/components/setup-checklist";
import { SuggestionCard } from "@/components/suggestion-card";
import { nextStep } from "@/core/next-step";
import { tickHealth } from "@/core/system-status";
import { agoLabel } from "@/lib/format";
import { env } from "@/server/env";
import { lastTick } from "@/server/system-status";
import { remainingCards } from "@/server/deck";
import { budgetState } from "@/server/budget";
import { BudgetBar } from "@/components/budget-bar";
import { upcomingForHome } from "@/server/special-days";
import { inDaysLabel, SHOW_DAYS_BEFORE } from "@/core/special-days";
import { storyYearToShow } from "@/core/story";
import { isSurpriseHidden, suggestTasks } from "@/core/date-extras";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { listTasks } from "@/server/date-tasks";
import type { DateCardExtras } from "@/components/date-card";
import { DateTime } from "luxon";
import { APP_TIMEZONE } from "@/lib/domain";
import { countSubscriptions } from "@/server/push";
import { hasSeenIntro, requireCouple } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { coupleNow } from "@/server/clock";
import { activeDateOf, cycleHistory, ensureCurrentCycle } from "@/server/cycles";
import { countIdeas } from "@/server/ideas";
import { dateToReview } from "@/server/reviews";
import { upcomingEvents } from "@/server/events";
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
  if (!(await hasSeenIntro(ctx.user))) redirect("/welcome");
  // Time-based and writes the round state – only for real requests, not prefetches.
  await connection();
  const { user, partner, coupleId } = ctx;
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  const [ideaCount, calendars, history, nextDate, pushDevices, toReview, weekEvents, tick, deckCount, budget, specialDays] = await Promise.all([
    countIdeas(coupleId),
    calendarStates(ctx),
    cycleHistory(coupleId),
    upcomingDate(coupleId, now),
    countSubscriptions(user.id),
    dateToReview(ctx, now),
    upcomingEvents(coupleId, now, 7),
    lastTick(),
    remainingCards(ctx, now),
    budgetState(coupleId, now),
    upcomingForHome(ctx, now, SHOW_DAYS_BEFORE),
  ]);
  // The cron runs in real time (not the dev clock). Only warn once it has worked before –
  // "never ran" is a setup step, shown under Einstellungen → Läuft alles?
  // A surprise stays one: the partner sees time and hint only.
  const shownDate = nextDate ? dateForViewer(nextDate, user.id, [user, partner], now) : undefined;
  const hiddenForMe = nextDate ? isSurpriseHidden(nextDate, user.id, now) : false;
  const tasks = nextDate && !hiddenForMe ? await listTasks(nextDate.id) : null;
  const dateExtras: DateCardExtras | undefined = nextDate && {
    tasks: tasks?.map((t) => ({ id: t.id, title: t.title, done: t.doneAt !== null })) ?? null,
    suggestions: tasks ? suggestTasks(nextDate, tasks.map((t) => t.title)) : [],
    isToday: DateTime.fromJSDate(nextDate.startsAt, { zone: APP_TIMEZONE }).hasSame(DateTime.fromJSDate(now, { zone: APP_TIMEZONE }), "day"),
    surprise: hiddenForMe ? "hidden" : nextDate.surprise && nextDate.organizerId === user.id && isSurpriseHidden(nextDate, partner.id, now) ? "organizer" : null,
  };
  const realNow = new Date();
  const storyYear = storyYearToShow(now);
  const cronStale = Boolean(env().cronSecret) && tick !== null && tickHealth(tick.at, realNow) === "stale";
  const roundDate = cycle?.status === "done" ? await activeDateOf(cycle.id) : undefined;
  const calendarsReady = calendars.every((person) => person.state === "connected");
  if (!cycle) return null;

  const isOpen = cycle.status === "open";
  const previous = history.at(-2);
  const suggestion = isOpen && cycle.mode === "suggestion" && calendarsReady ? await currentSuggestion(ctx, cycle, now) : null;

  const step = nextStep({
    meId: user.id,
    myCalendar: calendars.find((p) => p.isMe)?.state ?? "missing",
    partnerCalendar: calendars.find((p) => !p.isMe)?.state ?? "missing",
    cycle,
    upcoming: nextDate ?? null,
    toReview: toReview ? { id: toReview.id, title: toReview.title } : null,
  });

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <AppHeader user={user} partner={partner} />
      <p className="text-[17px] font-bold text-muted">Hey {user.name}!</p>

      {cronStale && tick && (
        <Link href="/settings#status" role="alert" className="sticker block rounded-[20px] bg-zitrone px-4 py-3 font-bold text-tinte">
          ⚠️ Die Automatik ist zuletzt {agoLabel(realNow, tick.at)} gelaufen – Erinnerungen kommen gerade nicht.{" "}
          <span className="underline">Läuft alles?</span>
        </Link>
      )}

      <NextStepCard step={step} cycle={cycle} me={user} partner={partner} now={now} date={shownDate} />

      {suggestion?.status === "ok" && <SuggestionCard suggestion={suggestion.suggestion} idea={suggestion.idea} />}
      {suggestion?.status === "no_slots" && (
        <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-3 font-bold">
          Diese Runde findet der Date-O-Mat keine gemeinsame Lücke mehr. Schaut unter „Planen“, ob ihr später Zeit habt.
        </p>
      )}

      {storyYear !== null && (
        <Link href={`/story?year=${storyYear}`} className="press sticker flex items-center gap-3 rounded-[20px] bg-himbeere px-4 py-3 text-tinte">
          <span className="text-3xl" aria-hidden="true">
            📖
          </span>
          <span className="font-display text-lg font-semibold leading-tight">Eure Date-Story {storyYear} ist da – tipp rein!</span>
        </Link>
      )}

      {specialDays.slice(0, 2).map((day) => (
        <div key={day.id} className="sticker flex flex-col gap-2 rounded-[20px] bg-himbeere-soft px-4 py-3.5 text-tinte">
          <p className="font-display text-lg font-semibold">
            {day.emoji} {day.label} {inDaysLabel(day.days)}
          </p>
          <p className="text-sm font-bold">
            {day.kind === "birthday" ? "Zeit für eine Überraschung." : "Wie wär's mit einem großen Date?"}
            {budget && budget.pot > 0 ? ` Im Spartopf: ${budget.pot} € 🎁` : ""}
          </p>
          <Link href="/plan?size=large" className="self-start text-sm font-extrabold underline">
            {day.kind === "birthday" ? "Überraschung planen →" : "Großes Date planen →"}
          </Link>
        </div>
      ))}

      {shownDate && <DateCard date={shownDate} me={user} partner={partner} showConfirm={false} extras={dateExtras} />}

      {/* Not the main step right now (e.g. it's my turn) – but still worth a reminder. */}
      {toReview && step.kind !== "review" && (
        <Link href={`/dates/${toReview.id}`} className="press sticker flex items-center gap-3 rounded-[20px] bg-lavendel/30 px-4 py-3">
          <span className="text-2xl" aria-hidden="true">
            💭
          </span>
          <span className="font-bold">
            Wie war „{toReview.title}“? <span className="underline">Jetzt bewerten</span>
          </span>
        </Link>
      )}

      {roundDate?.status === "done" && (
        <form action={notHappenedAction.bind(null, roundDate.id)} className="-mt-2 self-center">
          <button type="submit" className="text-sm font-extrabold text-muted underline">
            „{roundDate.title}“ hat doch nicht geklappt?
          </button>
        </form>
      )}

      {isOpen && previous?.status === "skipped" && (
        <div className="flex items-start gap-3 rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3.5 text-tinte">
          <span className="text-2xl leading-none" aria-hidden="true">
            🌦️
          </span>
          <p>
            <strong className="block font-extrabold">Letzte Runde ist ausgefallen – passiert!</strong>
            <span className="font-semibold">Kein Stress. Diese Runde holt ihr&apos;s nach.</span>
          </p>
        </div>
      )}

      {budget && <BudgetBar {...budget} />}

      <SetupChecklist
        calendar={calendars.find((p) => p.isMe)?.state === "connected"}
        partnerName={partner.name}
        partnerCalendar={calendars.find((p) => !p.isMe)?.state === "connected"}
        pushOn={pushDevices > 0}
      />

      <CycleHistory history={history} currentId={cycle.id} />

      {(deckCount > 0 || env().ai) && (
        <Link href="/ideas/entdecken" className="press sticker flex items-center gap-3 rounded-[20px] bg-himbeere-soft px-4 py-3 text-tinte">
          <span className="text-3xl" aria-hidden="true">
            💞
          </span>
          <span className="flex flex-col">
            <span className="font-display text-lg font-semibold leading-tight">
              {deckCount > 0 ? `${deckCount} ${deckCount === 1 ? "neue Idee" : "neue Ideen"} zum Swipen` : "Ideen entdecken"}
            </span>
            <span className="text-xs font-bold">Wischt beide nach rechts – dann ist&apos;s ein Match</span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/ideas" className="press sticker flex flex-col gap-0.5 rounded-[20px] bg-zitrone-soft px-3.5 py-3 text-tinte">
          <span className="text-2xl" aria-hidden="true">
            💡
          </span>
          <span className="font-display text-base font-semibold leading-tight">
            {ideaCount === 0 ? "Noch keine Ideen" : `${ideaCount} ${ideaCount === 1 ? "Idee" : "Ideen"}`}
          </span>
          <span className="text-xs font-bold">auf eurer Wunschliste</span>
        </Link>
        <Link href={weekEvents.length ? "/events" : "/ideas/koeln"} className="press sticker flex flex-col gap-0.5 rounded-[20px] bg-himmel/40 px-3.5 py-3 text-ink">
          <span className="text-2xl" aria-hidden="true">
            {weekEvents.length ? "🎟️" : "📍"}
          </span>
          <span className="font-display text-base font-semibold leading-tight">
            {weekEvents.length ? `${weekEvents.length} ${weekEvents.length === 1 ? "Event" : "Events"}` : "Köln-Ideen"}
          </span>
          <span className="text-xs font-bold">{weekEvents.length ? "in den nächsten 7 Tagen" : "zum Stöbern"}</span>
        </Link>
      </div>
    </div>
  );
}
