import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { extraOn, getCoupleSettings } from "@/server/settings";
import { env } from "@/server/env";
import { periodLabel } from "@/core/next-step";
import { budgetState } from "@/server/budget";
import { budgetHint } from "@/core/budget";
import { countDoneDates, dateForViewer, getDate } from "@/server/dates";
import { listIdeas, matchedIdeaIds } from "@/server/ideas";
import { PlanFlow, type IdeaOption, type RescheduleInfo } from "./plan-form";
import { AppHeader } from "@/components/app-header";
import { loadOverview, StartNotices } from "../overview";
import { AutoRefresh } from "@/components/auto-refresh";
import { Beet, BeetAvatars, RoundDots } from "../beet";
import { plantRounds } from "@/server/plant";
import { shownPot } from "@/core/bloom";
import type { NextDateInfo } from "@/components/swap-confirm";

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The step card says what's up – the page title is for screen readers. */}
      <h1 className="sr-only">Date planen</h1>
      <Suspense fallback={<BeetSkeleton />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * The start page and the one flow of the app. The start: the step card (what's
 * up, the one thing to do) and the swipe deck. "Date planen" (?pick=1) opens the
 * flow: "Was wollt ihr machen?" → "Wann?" → done. With the round's date planned,
 * "Lieber was anderes?" swaps its idea instead.
 */
async function Plan({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const [settings, params] = await Promise.all([getCoupleSettings(ctx.coupleId), searchParams]);
  const now = coupleNow(settings);
  // The round rolls over first (once) – everything after reads it.
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  // "Selbst aussuchen" in suggestion mode is the flow too.
  const self = params.self === "1";
  const later = params.later === "1";
  const rescheduleId = typeof params.reschedule === "string" && /^[0-9a-f-]{36}$/.test(params.reschedule) ? params.reschedule : undefined;
  const wantsFlow = Boolean(rescheduleId) || params.pick === "1" || self || later || typeof params.idea === "string" || params.size === "large";
  // All reads in one round trip: what the Beet needs, or what the flow needs – not one after the other.
  const [overview, existing, beetRounds, flowData] = await Promise.all([
    loadOverview(ctx, settings, now, cycle),
    rescheduleId ? getDate(ctx.coupleId, rescheduleId) : undefined,
    wantsFlow ? null : plantRounds(ctx.coupleId),
    wantsFlow ? Promise.all([budgetState(ctx.coupleId, now), countDoneDates(ctx.coupleId), listIdeas(ctx.coupleId), matchedIdeaIds(ctx.coupleId)]) : null,
  ]);
  // Moving someone else's surprise: the time changes, the secret stays.
  const shownExisting = existing && dateForViewer(existing, ctx.user.id, [ctx.user, ctx.partner], now);
  const reschedule: RescheduleInfo | undefined =
    shownExisting && (shownExisting.status === "planned" || shownExisting.status === "confirmed")
      ? { dateId: shownExisting.id, size: shownExisting.size, title: shownExisting.title, keepSecret: shownExisting !== existing }
      : undefined;

  // The round has its date: no new one – but you can do something else instead.
  const next = overview.nextDate;
  const roundDate = !reschedule && next && cycle && (cycle.status === "planned" || cycle.status === "confirmed") && next.cycleId === cycle.id ? next : undefined;
  const nextInfo: NextDateInfo | undefined = roundDate && {
    id: roundDate.id,
    title: roundDate.title,
    when: `${formatShortDate(roundDate.startsAt)}, ${formatTimeRange(roundDate.startsAt, roundDate.endsAt)}`,
    size: roundDate.size,
  };
  // Someone else's surprise is theirs to change.
  const swappable = Boolean(roundDate && overview.shownDate === roundDate);

  // "Date planen", a match, a special day, "Auch danach suchen": the flow. Otherwise the start.
  const flow = Boolean(reschedule) || params.pick === "1" || self || later || typeof params.idea === "string" || params.size === "large";
  if (!flow || (roundDate && !swappable)) {
    // Rare: the flow was asked for, but the round's date is someone else's surprise – the Beet after all.
    const rounds = beetRounds ?? (await plantRounds(ctx.coupleId));
    const step = overview.step;
    const onTurn = step?.kind === "plan" || step?.kind === "confirm" ? "me" : step?.kind === "partner_turn" || step?.kind === "wait_confirm" ? "partner" : null;
    const calendarStep = step?.kind === "connect_calendar" || step?.kind === "partner_calendar";
    return (
      <>
        <AutoRefresh />
        <AppHeader center={step && <RoundDots step={step.kind} />} action={<BeetAvatars me={ctx.user} partner={ctx.partner} onTurn={onTurn} />} />
        <Beet
          o={overview}
          ctx={ctx}
          now={now}
          rounds={rounds}
          swappable={swappable}
          pot={shownPot(settings.flowerPot, rounds.filter((r) => r === "done").length)}
          notices={
            <>
              {/* The dev clock moves "now" for the whole round logic – say so, or the Beet makes no sense. */}
              {env().devTools && settings.devClockOffsetMinutes !== 0 && (
                <Link href="/settings?t=konto" data-dev-clock className="meta self-start rounded-full bg-zitrone-soft px-3 py-1 text-tinte">
                  🧪 dev-uhr: {formatShortDate(now)} · zurücksetzen ›
                </Link>
              )}
              {calendarStep && <ConnectCalendarCard people={overview.calendars} next="/plan" />}
              <StartNotices o={overview} ctx={ctx} />
            </>
          }
        />
      </>
    );
  }

  // The same cards as on the wishlist; longest waiting first – the order the suggestion mode uses.
  const [budget, doneDates, wishlist, matched] = flowData ?? (await Promise.all([budgetState(ctx.coupleId, now), countDoneDates(ctx.coupleId), listIdeas(ctx.coupleId), matchedIdeaIds(ctx.coupleId)]));
  const people = Object.fromEntries([ctx.user, ctx.partner].map((p) => [p.id, { name: p.name, color: p.color }]));
  const ideas: IdeaOption[] = wishlist
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((idea) => ({
      id: idea.id,
      title: idea.title,
      size: idea.size,
      costEur: idea.costEur,
      location: idea.location,
      setting: idea.setting,
      category: idea.category,
      note: idea.note,
      url: idea.url,
      matched: matched.has(idea.id),
      overBudget: Boolean(budget && budgetHint(idea.costEur, budget.left)),
      creator: idea.createdById ? (people[idea.createdById] ?? null) : null,
    }));

  if (roundDate && nextInfo) {
    return <PlanFlow mode={{ kind: "swap", next: { ...nextInfo, ideaId: roundDate.ideaId } }} ideas={ideas} partnerName={ctx.partner.name} aiEnabled={env().ai} />;
  }
  // Whose turn it is stands in the step card; only the suggestion mode says so here.
  const roundInfo = cycle && cycle.mode === "suggestion" && <p className="text-sm text-muted">{periodLabel(cycle.startsAt, cycle.endsAt)} · der Date-O-Mat schlägt vor</p>;
  const scopeLink = cycle && (
    <Link
      href={`/plan?${new URLSearchParams({ ...(later ? {} : { later: "1" }), ...(reschedule ? { reschedule: reschedule.dateId } : {}), ...(typeof params.idea === "string" ? { idea: params.idea } : {}), ...(self ? { self: "1" } : {}) })}`}
      className="self-center text-[13px] font-semibold text-muted underline"
    >
      {later ? `Nur ${periodLabel(cycle.startsAt, cycle.endsAt).toLowerCase()} suchen` : "Auch danach suchen"}
    </Link>
  );

  // Both calendars are needed for free times (a stored state – no call to Google here).
  if (overview.calendars.some((p) => p.state !== "connected")) {
    return (
      <>
        <Link href="/plan" className="self-start text-sm font-semibold text-muted underline">
          ← Zurück
        </Link>
        <ConnectCalendarCard people={overview.calendars} next="/plan" />
      </>
    );
  }

  const budgetLine = budget && !reschedule && budget.level === "ok" && (
    <Link href="/budget" className="underline">
      {budget.label}: {budget.spending.spent + budget.spending.planned} von {budget.budget} € · noch {budget.left} €
    </Link>
  );
  const hoursLeft = cycle && cycle.status === "open" && cycle.deadlineAt > now ? `${Math.round((cycle.deadlineAt.getTime() - now.getTime()) / 3_600_000)} h` : undefined;
  return (
    <PlanFlow
      hoursLeft={hoursLeft}
      mode={reschedule ? { kind: "reschedule", date: reschedule } : { kind: "new" }}
      intro={!reschedule && roundInfo}
      budget={budget && !reschedule ? { left: budget.left, pot: budget.pot } : null}
      budgetLine={budgetLine || undefined}
      later={later}
      ideas={ideas}
      partnerName={ctx.partner.name}
      searchScopeLink={scopeLink}
      preselectIdeaId={typeof params.idea === "string" ? params.idea : undefined}
      preselectSize={params.size === "large" ? "large" : undefined}
      aiEnabled={env().ai}
      surpriseEnabled={extraOn(settings, "surprise") && doneDates > 0}
      withEvents={!reschedule}
    />
  );
}

/** The shape of the Beet while it loads (the tab is there at once): name, dots, headline, plant, button. */
function BeetSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" aria-busy="true" aria-label="Lädt …">
      <AppHeader center={<span className="block h-1.5 w-12 animate-pulse rounded-full bg-track" />} />
      <div className="flex animate-pulse flex-1 flex-col gap-3">
        <div className="h-[46px] w-3/4 rounded-[16px] bg-track" />
        <div className="h-[46px] w-1/2 rounded-[16px] bg-track" />
        <div className="h-3 w-2/3 rounded-full bg-track" />
        <div className="mx-auto mt-auto size-40 rounded-full bg-track" />
        <div className="mt-auto h-14 rounded-full bg-track" />
      </div>
    </div>
  );
}
