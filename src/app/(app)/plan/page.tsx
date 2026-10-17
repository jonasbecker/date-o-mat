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
import { loadOverview, StartSection } from "../overview";
import { AutoRefresh } from "@/components/auto-refresh";
import { buttonClass } from "@/components/button";
import { SwapIcon } from "@/components/icons";
import { SwipeTeaser } from "@/components/swipe-teaser";
import type { NextDateInfo } from "@/components/swap-confirm";

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The step card says what's up – the page title is for screen readers. */}
      <h1 className="sr-only">Date planen</h1>
      <AppHeader />
      <Suspense fallback={<SlotsSkeleton />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/**
 * The start page and the one flow of the app: on top what needs you (the next
 * date, "Passt!", what to rate); below it "Was wollt ihr machen?" → "Wann?" → done.
 * With the round's date planned, "Lieber was anderes?" swaps its idea instead.
 */
async function Plan({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const settings = await getCoupleSettings(ctx.coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  const [params, overview] = await Promise.all([searchParams, loadOverview(ctx, settings, now)]);
  // "Lieber selbst aussuchen" in suggestion mode: the flow instead of the proposal.
  const self = params.self === "1";
  const top = (afterDate?: React.ReactNode, teaser?: React.ReactNode) => (
    <>
      <AutoRefresh />
      <StartSection o={overview} ctx={ctx} now={now} afterDate={afterDate} teaser={teaser} hideSuggestion={self} />
    </>
  );
  const later = params.later === "1";
  const rescheduleId = typeof params.reschedule === "string" && /^[0-9a-f-]{36}$/.test(params.reschedule) ? params.reschedule : undefined;
  const existing = rescheduleId ? await getDate(ctx.coupleId, rescheduleId) : undefined;
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
  const swappable = roundDate && overview.shownDate === roundDate;

  const [budget, doneDates] = await Promise.all([budgetState(ctx.coupleId, now), countDoneDates(ctx.coupleId)]);
  // The same cards as on the wishlist; longest waiting first – the order the suggestion mode uses.
  const [wishlist, matched] = await Promise.all([listIdeas(ctx.coupleId), matchedIdeaIds(ctx.coupleId)]);
  const people = Object.fromEntries([ctx.user, ctx.partner].map((p) => [p.id, { name: p.name, color: p.color }]));
  const ideas: IdeaOption[] = wishlist
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((idea) => ({
      id: idea.id,
      title: idea.title,
      size: idea.size,
      costEur: idea.costEur,
      location: idea.location,
      note: idea.note,
      url: idea.url,
      matched: matched.has(idea.id),
      overBudget: Boolean(budget && budgetHint(idea.costEur, budget.left)),
      creator: idea.createdById ? (people[idea.createdById] ?? null) : null,
    }));

  if (roundDate) {
    if (!swappable || !nextInfo) return top();
    if (params.pick !== "1") {
      return top(
        <Link href="/plan?pick=1" className={buttonClass("secondary", "md", "w-full")}>
          <SwapIcon width={20} height={20} /> Lieber was anderes machen?
        </Link>,
        // The date stands – collecting ideas for the next one is what is left to do.
        <SwipeTeaser deck={overview.deck} />,
      );
    }
    return (
      <PlanFlow
        mode={{ kind: "swap", next: { ...nextInfo, ideaId: roundDate.ideaId } }}
        ideas={ideas}
        partnerName={ctx.partner.name}
        aiEnabled={env().ai}
        intro={
          <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
            ← Doch nicht
          </Link>
        }
      />
    );
  }


  // The other one plans this time: swiping is the useful thing to do; planning yourself is one tap away.
  if (!reschedule && !self && overview.step?.kind === "partner_turn") {
    return top(
      <Link href="/plan?self=1" className="self-center text-sm font-extrabold underline">
        Lieber selbst planen →
      </Link>,
      <SwipeTeaser deck={overview.deck} big />,
    );
  }

  // Suggestion mode: the proposal is the start; planning yourself is one tap away.
  if (!reschedule && !self && overview.suggestion?.status === "ok") {
    return top(
      <Link href="/plan?self=1" className="self-center text-sm font-extrabold underline">
        Lieber selbst aussuchen →
      </Link>,
    );
  }
  // Whose turn it is stands in the step card; only the suggestion mode says so here.
  const roundInfo = cycle && cycle.mode === "suggestion" && <p className="text-sm font-extrabold text-muted">{periodLabel(cycle.startsAt, cycle.endsAt)} · der Date-O-Mat schlägt vor</p>;
  const scopeLink = cycle && (
    <Link
      href={`/plan?${new URLSearchParams({ ...(later ? {} : { later: "1" }), ...(reschedule ? { reschedule: reschedule.dateId } : {}), ...(typeof params.idea === "string" ? { idea: params.idea } : {}), ...(self ? { self: "1" } : {}) })}`}
      className="self-center text-sm font-extrabold underline"
    >
      {later ? `Nur ${periodLabel(cycle.startsAt, cycle.endsAt).toLowerCase()} suchen` : "Auch danach suchen"}
    </Link>
  );

  // Both calendars are needed for free times (a stored state – no call to Google here).
  if (overview.calendars.some((p) => p.state !== "connected")) {
    return (
      <>
        {top()}
        <ConnectCalendarCard people={overview.calendars} next="/plan" />
      </>
    );
  }

  const budgetLine = budget && !reschedule && budget.level === "ok" && (
    <Link href="/budget" className="underline">
      {budget.label}: {budget.spending.spent + budget.spending.planned} von {budget.budget} € · noch {budget.left} €
    </Link>
  );
  return (
    <PlanFlow
      mode={reschedule ? { kind: "reschedule", date: reschedule } : { kind: "new" }}
      intro={
        reschedule ? (
          <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
            ← Doch nicht
          </Link>
        ) : (
          <>
            {top()}
            {roundInfo}
          </>
        )
      }
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

function SlotsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-busy="true" aria-label="Sucht freie Zeiten …">
      <div className="h-[68px] rounded-[22px] bg-track" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[76px] rounded-[20px] bg-track" />
      ))}
    </div>
  );
}
