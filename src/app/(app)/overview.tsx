// What used to be the home screen, split along the order of a date:
// the state of the round sits on top of "Date planen", what is coming up
// (and what to rate) on top of "Dates". `/` sends you to whichever needs you.
import Link from "next/link";
import { DateTime } from "luxon";
import { notHappenedAction } from "./actions";
import { BudgetBar } from "@/components/budget-bar";
import { DateCard, type DateCardExtras } from "@/components/date-card";
import { NextStepCard } from "@/components/next-step";
import { SetupChecklist } from "@/components/setup-checklist";
import { SuggestionCard } from "@/components/suggestion-card";
import { isSurpriseHidden, suggestTasks } from "@/core/date-extras";
import { nextStep } from "@/core/next-step";
import { inDaysLabel, SHOW_DAYS_BEFORE } from "@/core/special-days";
import { storyYearToShow } from "@/core/story";
import { tickHealth } from "@/core/system-status";
import { APP_TIMEZONE } from "@/lib/domain";
import { agoLabel } from "@/lib/format";
import type { CoupleContext } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { budgetState } from "@/server/budget";
import { activeDateOf, cycleHistory, ensureCurrentCycle } from "@/server/cycles";
import { listTasks } from "@/server/date-tasks";
import { dateForViewer, upcomingDate } from "@/server/dates";
import type { CoupleSettings } from "@/server/db/schema";
import { env } from "@/server/env";
import { countSubscriptions } from "@/server/push";
import { dateToReview } from "@/server/reviews";
import { extraOn } from "@/server/settings";
import { upcomingForHome } from "@/server/special-days";
import { currentSuggestion } from "@/server/suggestions";
import { lastTick } from "@/server/system-status";

export async function loadOverview(ctx: CoupleContext, settings: CoupleSettings, now: Date) {
  const { user, partner, coupleId } = ctx;
  const cycle = await ensureCurrentCycle(coupleId, now);
  const [calendars, history, nextDate, pushDevices, toReview, tick, budget, specialDays] = await Promise.all([
    calendarStates(ctx),
    cycleHistory(coupleId),
    upcomingDate(coupleId, now),
    countSubscriptions(user.id),
    dateToReview(ctx, now),
    lastTick(),
    budgetState(coupleId, now),
    upcomingForHome(ctx, now, SHOW_DAYS_BEFORE),
  ]);
  // A surprise stays one: the partner sees time and hint only.
  const shownDate = nextDate ? dateForViewer(nextDate, user.id, [user, partner], now) : undefined;
  const hiddenForMe = nextDate ? isSurpriseHidden(nextDate, user.id, now) : false;
  const tasks = nextDate && !hiddenForMe && extraOn(settings, "checklist") ? await listTasks(nextDate.id) : null;
  const dateExtras: DateCardExtras | undefined = nextDate && {
    tasks: tasks?.map((t) => ({ id: t.id, title: t.title, done: t.doneAt !== null })) ?? null,
    suggestions: tasks ? suggestTasks(nextDate, tasks.map((t) => t.title)) : [],
    // "isToday" brings the conversation cards.
    isToday: extraOn(settings, "cards") && DateTime.fromJSDate(nextDate.startsAt, { zone: APP_TIMEZONE }).hasSame(DateTime.fromJSDate(now, { zone: APP_TIMEZONE }), "day"),
    surprise: hiddenForMe ? "hidden" : nextDate.surprise && nextDate.organizerId === user.id && isSurpriseHidden(nextDate, partner.id, now) ? "organizer" : null,
  };
  const realNow = new Date();
  // The cron runs in real time (not the dev clock). Only warn once it has worked before –
  // "never ran" is a setup step, shown under Einstellungen → Läuft alles?
  const cronStale = Boolean(env().cronSecret) && tick !== null && tickHealth(tick.at, realNow) === "stale";
  const roundDate = cycle?.status === "done" ? await activeDateOf(cycle.id) : undefined;
  const calendarsReady = calendars.every((person) => person.state === "connected");
  const suggestion = cycle && cycle.status === "open" && cycle.mode === "suggestion" && calendarsReady ? await currentSuggestion(ctx, cycle, now) : null;
  const step = cycle
    ? nextStep({
        meId: user.id,
        myCalendar: calendars.find((p) => p.isMe)?.state ?? "missing",
        partnerCalendar: calendars.find((p) => !p.isMe)?.state ?? "missing",
        cycle,
        upcoming: nextDate ?? null,
        toReview: toReview ? { id: toReview.id, title: toReview.title } : null,
      })
    : null;
  return {
    cycle,
    step,
    nextDate,
    shownDate,
    dateExtras,
    toReview,
    calendars,
    previous: history.at(-2),
    pushDevices,
    tick,
    realNow,
    cronStale,
    budget,
    specialDays,
    storyYear: extraOn(settings, "story") ? storyYearToShow(now) : null,
    roundDate,
    suggestion,
  };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;

/** Steps that are about a date – they head the Dates tab. */
const DATE_STEPS: string[] = ["confirm", "wait_confirm", "date_ahead", "review"];

/** Where opening the app lands: something coming up or to rate → Dates, otherwise → Date planen. */
export function landingPath(o: Pick<Overview, "nextDate" | "toReview">): "/dates" | "/plan" {
  return o.nextDate || o.toReview ? "/dates" : "/plan";
}

/** Top of "Date planen": the state of the round and what it needs. */
export function RoundSection({ o, ctx, now }: { o: Overview; ctx: CoupleContext; now: Date }) {
  const { user, partner } = ctx;
  if (!o.cycle || !o.step) return null;
  // The plan page shows its own "connect your calendar" card; date steps live on "Dates".
  const showStep = !["connect_calendar", "partner_calendar", ...DATE_STEPS].includes(o.step.kind);
  const dateNote =
    o.step.kind === "confirm"
      ? { text: `${partner.name} hat schon ein Date geplant.`, link: "Unter Dates „Passt!“ sagen →", href: "/dates" }
      : o.step.kind === "wait_confirm" || o.step.kind === "date_ahead"
        ? { text: "Diese Runde steht euer Date schon – hier unten könnt ihr den Termin ändern.", link: "Zum Date →", href: "/dates" }
        : o.step.kind === "review"
          ? { text: `Erst mal: Wie war „${o.step.title}“?`, link: "Bewerten →", href: `/dates/${o.step.dateId}` }
          : null;
  return (
    <>
      {o.cronStale && o.tick && (
        <Link href="/settings#status" role="alert" className="sticker block rounded-[20px] bg-zitrone px-4 py-3 font-bold text-tinte">
          ⚠️ Die Automatik ist zuletzt {agoLabel(o.realNow, o.tick.at)} gelaufen – Erinnerungen kommen gerade nicht.{" "}
          <span className="underline">Läuft alles?</span>
        </Link>
      )}

      {showStep && <NextStepCard step={o.step} cycle={o.cycle} me={user} partner={partner} now={now} date={o.shownDate} onPlanPage />}
      {dateNote && (
        <p className="rounded-[20px] border-2 border-line bg-surface px-4 py-3 font-bold">
          {dateNote.text}{" "}
          <Link href={dateNote.href} className="underline">
            {dateNote.link}
          </Link>
        </p>
      )}

      {o.suggestion?.status === "ok" && <SuggestionCard suggestion={o.suggestion.suggestion} idea={o.suggestion.idea} />}
      {o.suggestion?.status === "no_slots" && (
        <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-3 font-bold">
          Diese Runde findet der Date-O-Mat keine gemeinsame Lücke mehr. Sucht unten auch nach dem Rundenende.
        </p>
      )}

      {o.specialDays.slice(0, 2).map((day) => (
        <div key={day.id} className="sticker flex flex-col gap-2 rounded-[20px] bg-himbeere-soft px-4 py-3.5 text-tinte">
          <p className="font-display text-lg font-semibold">
            {day.emoji} {day.label} {inDaysLabel(day.days)}
          </p>
          <p className="text-sm font-bold">
            {day.kind === "birthday" ? "Zeit für eine Überraschung." : "Wie wär's mit einem großen Date?"}
            {o.budget && o.budget.pot > 0 ? ` Im Spartopf: ${o.budget.pot} € 🎁` : ""}
          </p>
          <Link href="/plan?size=large" className="self-start text-sm font-extrabold underline">
            {day.kind === "birthday" ? "Überraschung planen →" : "Großes Date planen →"}
          </Link>
        </div>
      ))}

      {o.cycle.status === "open" && o.previous?.status === "skipped" && (
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

      <SetupChecklist
        calendar={o.calendars.find((p) => p.isMe)?.state === "connected"}
        partnerName={partner.name}
        partnerCalendar={o.calendars.find((p) => !p.isMe)?.state === "connected"}
        pushOn={o.pushDevices > 0}
      />
    </>
  );
}

/** Top of "Dates": the next date (with "Passt!"), what to rate, the story. */
export function UpcomingSection({ o, ctx, now }: { o: Overview; ctx: CoupleContext; now: Date }) {
  const { user, partner } = ctx;
  const stepCard = o.cycle && o.step && DATE_STEPS.includes(o.step.kind);
  return (
    <>
      {o.cronStale && o.tick && (
        <Link href="/settings#status" role="alert" className="sticker block rounded-[20px] bg-zitrone px-4 py-3 font-bold text-tinte">
          ⚠️ Die Automatik ist zuletzt {agoLabel(o.realNow, o.tick.at)} gelaufen – Erinnerungen kommen gerade nicht.{" "}
          <span className="underline">Läuft alles?</span>
        </Link>
      )}

      {o.storyYear !== null && (
        <Link href={`/story?year=${o.storyYear}`} className="press sticker flex items-center gap-3 rounded-[20px] bg-himbeere px-4 py-3 text-tinte">
          <span className="text-3xl" aria-hidden="true">
            📖
          </span>
          <span className="font-display text-lg font-semibold leading-tight">Eure Date-Story {o.storyYear} ist da – tipp rein!</span>
        </Link>
      )}

      {stepCard && <NextStepCard step={o.step!} cycle={o.cycle!} me={user} partner={partner} now={now} date={o.shownDate} />}

      {o.toReview && o.step?.kind !== "review" && (
        <Link href={`/dates/${o.toReview.id}`} className="press sticker flex items-center gap-3 rounded-[20px] bg-lavendel px-4 py-3 text-tinte">
          <span className="text-2xl" aria-hidden="true">
            💭
          </span>
          <span className="font-bold">
            Wie war „{o.toReview.title}“? <span className="underline">Jetzt bewerten</span>
          </span>
        </Link>
      )}

      {/* "Passt!" sits in the step card when there is one. */}
      {o.shownDate && <DateCard date={o.shownDate} me={user} partner={partner} showConfirm={!stepCard} extras={o.dateExtras} />}

      {o.roundDate?.status === "done" && (
        <form action={notHappenedAction.bind(null, o.roundDate.id)} className="-mt-2 self-center">
          <button type="submit" className="text-sm font-extrabold text-muted underline">
            „{o.roundDate.title}“ hat doch nicht geklappt?
          </button>
        </form>
      )}

      {/* The budget only speaks up when it gets tight; otherwise it lives under /budget. */}
      {o.budget && o.budget.level !== "ok" && <BudgetBar {...o.budget} />}
    </>
  );
}
