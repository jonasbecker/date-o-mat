// The top of the start page: the next date, what to rate and the state of the
// round. Below it runs the planning flow (idea → time → done).
import Link from "next/link";
import { DateTime } from "luxon";
import { confirmDateAction, notHappenedAction } from "./actions";
import { ConfettiActionButton } from "@/components/confetti";
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
import type { CoupleSettings, DatePlan } from "@/server/db/schema";
import { env } from "@/server/env";
import { countSubscriptions } from "@/server/push";
import { dateToReview } from "@/server/reviews";
import { extraOn } from "@/server/settings";
import { upcomingForHome } from "@/server/special-days";
import { currentSuggestion } from "@/server/suggestions";
import { lastTick } from "@/server/system-status";
import { deckTeaser } from "@/server/deck";

/** Checklist, conversation cards and surprise notes for an upcoming date. */
export async function dateExtrasFor(ctx: CoupleContext, settings: CoupleSettings, date: DatePlan, now: Date): Promise<DateCardExtras> {
  const { user, partner } = ctx;
  const hiddenForMe = isSurpriseHidden(date, user.id, now);
  const tasks = !hiddenForMe && extraOn(settings, "checklist") ? await listTasks(date.id) : null;
  return {
    tasks: tasks?.map((t) => ({ id: t.id, title: t.title, done: t.doneAt !== null })) ?? null,
    suggestions: tasks ? suggestTasks(date, tasks.map((t) => t.title)) : [],
    // "isToday" brings the conversation cards.
    isToday: extraOn(settings, "cards") && DateTime.fromJSDate(date.startsAt, { zone: APP_TIMEZONE }).hasSame(DateTime.fromJSDate(now, { zone: APP_TIMEZONE }), "day"),
    surprise: hiddenForMe ? "hidden" : date.surprise && date.organizerId === user.id && isSurpriseHidden(date, partner.id, now) ? "organizer" : null,
  };
}

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
  const deck = await deckTeaser(ctx, now);
  // A surprise stays one: the partner sees time and hint only.
  const shownDate = nextDate ? dateForViewer(nextDate, user.id, [user, partner], now) : undefined;
  const dateExtras = nextDate ? await dateExtrasFor(ctx, settings, nextDate, now) : undefined;
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
    deck,
  };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;

/** Steps that are about a date – the full status card heads the start page. */
const DATE_STEPS: string[] = ["confirm", "wait_confirm", "date_ahead", "review"];

/**
 * Top of the start page ("Date planen"): what needs you right now – the next
 * date with "Passt!", what to rate, the state of the round – above the planning flow.
 */
export function StartSection({
  o,
  ctx,
  now,
  afterDate,
  teaser,
  hideSuggestion = false,
}: {
  o: Overview;
  ctx: CoupleContext;
  now: Date;
  /** At the bottom, with "Passt!" (e.g. "Lieber was anderes machen?"). */
  afterDate?: React.ReactNode;
  /** "Solange swipen?" – below the date or the step card. */
  teaser?: React.ReactNode;
  /** "Lieber selbst aussuchen": the flow takes the place of the proposal. */
  hideSuggestion?: boolean;
}) {
  const { user, partner } = ctx;
  const dateStep = Boolean(o.cycle && o.step && DATE_STEPS.includes(o.step.kind));
  // Cards stay small: the start page is one screen.
  const confirmable = Boolean(o.shownDate && o.shownDate.status === "planned" && o.shownDate.proposedById !== user.id);
  // Last round fell through: said in the step card's own box, not in a card of its own.
  const skippedNote = o.cycle?.status === "open" && o.previous?.status === "skipped" && (
    <>
      🌦️ <strong className="font-extrabold">Letztes Mal ist ausgefallen – passiert!</strong> Diesmal holt ihr&apos;s nach.
    </>
  );
  // The flow below shows its own "connect your calendar" card.
  const roundStep = o.cycle && o.step && !dateStep && !["connect_calendar", "partner_calendar"].includes(o.step.kind);
  return (
    <>
      {o.cronStale && o.tick && (
        <Link href="/settings?t=status" role="alert" className="sticker block rounded-[20px] bg-zitrone px-4 py-3 font-bold text-tinte">
          ⚠️ Die Automatik ist zuletzt {agoLabel(o.realNow, o.tick.at)} gelaufen – Erinnerungen kommen gerade nicht.{" "}
          <span className="underline">Läuft alles?</span>
        </Link>
      )}

      {o.storyYear !== null && (
        <Link href={`/story?year=${o.storyYear}`} className="flat tap flex items-center gap-3 rounded-[18px] bg-himbeere-soft px-4 py-2.5 text-tinte">
          <span className="text-2xl" aria-hidden="true">
            📖
          </span>
          <span className="font-display text-base font-semibold leading-tight">Eure Date-Story {o.storyYear} ist da – tipp rein!</span>
        </Link>
      )}

      {(dateStep || roundStep) && <NextStepCard step={o.step!} cycle={o.cycle!} me={user} partner={partner} now={now} date={o.shownDate} onPlanPage note={skippedNote} />}

      {o.toReview && o.step?.kind !== "review" && (
        <Link href={`/dates/${o.toReview.id}`} className="press sticker flex items-center gap-3 rounded-[18px] bg-lavendel px-4 py-2.5 text-tinte">
          <span className="text-2xl" aria-hidden="true">
            💭
          </span>
          <span className="font-bold">
            Wie war „{o.toReview.title}“? <span className="underline">Jetzt bewerten</span>
          </span>
        </Link>
      )}

      {/* "Passt!" sits in the step card when there is one; the details are one tap away. */}
      {/* The whole date right here – the start page has the room. "Passt!" sits at the bottom. */}
      {o.shownDate && <DateCard date={o.shownDate} me={user} partner={partner} showConfirm={false} extras={o.dateExtras} compact />}

      {teaser}

      {o.roundDate?.status === "done" && (
        <form action={notHappenedAction.bind(null, o.roundDate.id)} className="-mt-2 self-center">
          <button type="submit" className="text-sm font-extrabold text-muted underline">
            „{o.roundDate.title}“ hat doch nicht geklappt?
          </button>
        </form>
      )}

      {!hideSuggestion && o.suggestion?.status === "ok" && <SuggestionCard suggestion={o.suggestion.suggestion} idea={o.suggestion.idea} />}
      {o.suggestion?.status === "no_slots" && (
        <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-3 font-bold">
          Bis zum Ende findet der Date-O-Mat keine gemeinsame Lücke mehr – sucht beim Planen auch danach.
        </p>
      )}

      {!o.shownDate &&
        o.specialDays.slice(0, 2).map((day) => (
          <Link key={day.id} href="/plan?size=large" className="press flex items-center gap-2.5 rounded-[18px] border-2 border-line bg-himbeere-soft px-3.5 py-2 text-sm font-bold text-tinte">
            <span className="min-w-0 flex-1">
              {day.emoji} {day.label} {inDaysLabel(day.days)}
              {o.budget && o.budget.pot > 0 ? ` · Spartopf ${o.budget.pot} € 🎁` : ""}
            </span>
            <span className="shrink-0 underline">{day.kind === "birthday" ? "Überraschung planen →" : "Großes Date planen →"}</span>
          </Link>
        ))}

      {skippedNote && !(dateStep || roundStep) && (
        <p className="rounded-[18px] border-2 border-line bg-zitrone-soft px-3.5 py-2 text-sm font-bold text-tinte">{skippedNote}</p>
      )}

      {/* The budget only speaks up when it gets tight; otherwise it lives under /budget. */}
      {o.budget && o.budget.level !== "ok" && <BudgetBar {...o.budget} />}

      <SetupChecklist
        calendar={o.calendars.find((p) => p.isMe)?.state === "connected"}
        partnerName={partner.name}
        partnerCalendar={o.calendars.find((p) => !p.isMe)?.state === "connected"}
        pushOn={o.pushDevices > 0}
      />

      {/* What you tap sits at the bottom, where the thumb is. */}
      {(confirmable || afterDate) && (
        <div className="mt-auto flex flex-col gap-2 pt-1">
          {confirmable && (
            <ConfettiActionButton action={confirmDateAction.bind(null, o.shownDate!.id)} className="w-full">
              Passt! 💚
            </ConfettiActionButton>
          )}
          {afterDate}
        </div>
      )}
    </>
  );
}
