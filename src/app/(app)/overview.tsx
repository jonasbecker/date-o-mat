// What the start page (the Beet) needs: the round, the next step, the next date and the small
// lines around the plant. "Date planen" leads into the flow.
import Link from "next/link";
import { DateTime } from "luxon";
import { notHappenedAction } from "./actions";
import { NotHappenedButton } from "./not-happened-button";
import { BudgetBar } from "@/components/budget-bar";
import type { DateCardExtras } from "@/components/date-card";
import { StartReview } from "@/components/start-review";
import { SetupChecklist } from "@/components/setup-checklist";
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
import { dateForViewer, unansweredDate, upcomingDate } from "@/server/dates";
import type { CoupleSettings, Cycle, DatePlan } from "@/server/db/schema";
import { env } from "@/server/env";
import { countSubscriptions, pushPublicKey } from "@/server/push";
import { dateToReview } from "@/server/reviews";
import { extraOn } from "@/server/settings";
import { upcomingForHome } from "@/server/special-days";
import { currentSuggestion } from "@/server/suggestions";
import { lastTick } from "@/server/system-status";
import { coverPhotos } from "@/server/photos";

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

/** Everything the Beet shows. `cycle`: the round the page already rolled over (else it is done here). */
export async function loadOverview(ctx: CoupleContext, settings: CoupleSettings, now: Date, current?: Cycle | null) {
  const { user, partner, coupleId } = ctx;
  const cycle = current !== undefined ? current : await ensureCurrentCycle(coupleId, now);
  // One round trip for everything that only needs the round – then one for what builds on it.
  const [calendars, history, nextDate, pushDevices, partnerPushDevices, toReview, tick, budget, specialDays, roundDate, unanswered] = await Promise.all([
    calendarStates(ctx),
    cycleHistory(coupleId, now),
    upcomingDate(coupleId, now),
    countSubscriptions(user.id),
    countSubscriptions(partner.id),
    dateToReview(ctx, now),
    lastTick(),
    budgetState(coupleId, now),
    upcomingForHome(ctx, now, SHOW_DAYS_BEFORE),
    cycle?.status === "done" ? activeDateOf(cycle.id) : undefined,
    unansweredDate(coupleId, now),
  ]);
  const calendarsReady = calendars.every((person) => person.state === "connected");
  const [reviewPhoto, dateExtras, suggestion] = await Promise.all([
    // "Wie war's?" shows the date's first photo.
    toReview ? coverPhotos(coupleId, [toReview.id]).then((photos) => photos.get(toReview.id)) : undefined,
    nextDate ? dateExtrasFor(ctx, settings, nextDate, now) : undefined,
    cycle && cycle.status === "open" && cycle.mode === "suggestion" && calendarsReady ? currentSuggestion(ctx, cycle, now) : null,
  ]);
  // A surprise stays one: the partner sees time and hint only.
  const shownDate = nextDate ? dateForViewer(nextDate, user.id, [user, partner], now) : undefined;
  const realNow = new Date();
  // The cron runs in real time (not the dev clock). Only warn once it has worked before –
  // "never ran" is a setup step, shown under Einstellungen → Läuft alles?
  const cronStale = Boolean(env().cronSecret) && tick !== null && tickHealth(tick.at, realNow) === "stale";
  const step = cycle
    ? nextStep({
        meId: user.id,
        myCalendar: calendars.find((p) => p.isMe)?.state ?? "missing",
        partnerCalendar: calendars.find((p) => !p.isMe)?.state ?? "missing",
        cycle,
        upcoming: nextDate ?? null,
        toReview: toReview ? { id: toReview.id, title: toReview.title } : null,
        unanswered: unanswered ? { id: unanswered.id, title: unanswered.title } : null,
      })
    : null;
  return {
    cycle,
    step,
    unanswered,
    nextDate,
    shownDate,
    dateExtras,
    toReview,
    reviewPhoto,
    calendars,
    previous: history.at(-2),
    push: { publicKey: pushPublicKey(), mine: pushDevices, partner: partnerPushDevices },
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

/**
 * The small lines on the Beet around the plant: the cron warning, the story, a skipped round,
 * special days, a tight budget, reminders, the setup checklist – only what applies right now.
 */
export function StartNotices({ o, ctx }: { o: Overview; ctx: CoupleContext }) {
  const { partner } = ctx;
  const step = o.cycle ? o.step : null;
  const line = "flex items-center gap-2.5 rounded-[18px] px-3.5 py-2 text-sm font-medium";
  return (
    <>
      {o.cronStale && o.tick && (
        <Link href="/settings?t=status" role="alert" className={`${line} bg-zitrone-soft text-tinte`}>
          <span className="min-w-0 flex-1">
            ⚠️ Die Automatik ist zuletzt {agoLabel(o.realNow, o.tick.at)} gelaufen – Erinnerungen kommen gerade nicht. <span className="underline">Läuft alles?</span>
          </span>
        </Link>
      )}

      {o.storyYear !== null && (
        <Link href={`/story?year=${o.storyYear}`} className={`tap ${line} bg-rose text-tinte`}>
          <span aria-hidden="true">📖</span>
          <span className="min-w-0 flex-1 font-semibold">Eure Date-Story {o.storyYear} ist da – tipp rein!</span>
        </Link>
      )}

      {/* "Letztes Mal ist ausgefallen" is said by the plant (a speech bubble on the Beet). */}

      {/* Another step heads the page (e.g. my turn to plan): the review still gets its own line, hearts and all. */}
      {o.toReview && step?.kind !== "review" && (
        <div data-review-card className="flex flex-col gap-1.5 rounded-[18px] bg-surface px-3.5 py-2.5 text-sm">
          <h3 className="text-base font-bold leading-tight">Wie war&apos;s?</h3>
          <StartReview date={o.toReview} photoId={o.reviewPhoto} small />
        </div>
      )}

      {o.roundDate?.status === "done" && (
        <NotHappenedButton title={o.roundDate.title} action={notHappenedAction.bind(null, o.roundDate.id)} />
      )}

      {o.suggestion?.status === "no_slots" && (
        <p className={`${line} border-[1.5px] border-dashed border-line`}>Bis zum Ende findet Zweisamen keine gemeinsame Lücke mehr – sucht beim Planen auch danach.</p>
      )}

      {/* At most two special days – the start page is one screen. */}
      {!o.shownDate &&
        o.specialDays.slice(0, 2).map((day) => (
          <Link key={day.id} href="/plan?size=large" className={`press ${line} bg-rose text-tinte`}>
            <span className="min-w-0 flex-1">
              {day.emoji} {day.label} {inDaysLabel(day.days)}
              {o.budget && o.budget.pot > 0 ? ` · Spartopf ${o.budget.pot} € 🎁` : ""}
            </span>
            <span className="shrink-0 font-semibold underline">{day.kind === "birthday" ? "Überraschung planen →" : "Großes Date planen →"}</span>
          </Link>
        ))}

      {/* The budget only speaks up when it gets tight; otherwise it lives under /budget. */}
      {o.budget && o.budget.level !== "ok" && <BudgetBar {...o.budget} />}

      {/* Reminders: the flower says it in its bubble (components/flower-voice.tsx) – no row of its own. */}

      <SetupChecklist
        calendar={o.calendars.find((p) => p.isMe)?.state === "connected"}
        partnerName={partner.name}
        partnerCalendar={o.calendars.find((p) => !p.isMe)?.state === "connected"}
      />
    </>
  );
}
