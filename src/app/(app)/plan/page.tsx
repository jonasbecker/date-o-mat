import Link from "next/link";
import { after, connection } from "next/server";
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
import { SwipeDeck } from "../ideas/entdecken/swipe-deck";
import { DECK_REFILL_BELOW } from "@/core/deck";
import { deckSize } from "@/core/start-layout";
import { SwipeTeaser } from "@/components/swipe-teaser";
import { refillDeck } from "@/server/deck";
import type { NextDateInfo } from "@/components/swap-confirm";

// "Neue Ideen holen" in the swipe deck waits for Claude (about half a minute).
export const maxDuration = 90;

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
 * The start page and the one flow of the app. The start: the step card (what's
 * up, the one thing to do) and the swipe deck. "Date planen" (?pick=1) opens the
 * flow: "Was wollt ihr machen?" → "Wann?" → done. With the round's date planned,
 * "Lieber was anderes?" swaps its idea instead.
 */
async function Plan({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const settings = await getCoupleSettings(ctx.coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  const [params, overview] = await Promise.all([searchParams, loadOverview(ctx, settings, now)]);
  // "Selbst aussuchen" in suggestion mode is the flow too.
  const self = params.self === "1";
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
  const swappable = Boolean(roundDate && overview.shownDate === roundDate);

  // "Date planen", a match, a special day, "Auch danach suchen": the flow. Otherwise the start.
  const flow = Boolean(reschedule) || params.pick === "1" || self || later || typeof params.idea === "string" || params.size === "large";
  if (!flow || (roundDate && !swappable)) {
    const deck = overview.deck;
    // Running low: the next batch is made in the background, AutoRefresh brings it in.
    if (!deck.generating && deck.cards.length < DECK_REFILL_BELOW) after(() => refillDeck(ctx.coupleId, now));
    return (
      <>
        <AutoRefresh intervalMs={deck.generating ? 6_000 : undefined} />
        <StartSection o={overview} ctx={ctx} now={now} swappable={swappable} />
        {/* Something pending: the box comes first. The swipe card takes what is left of the screen
            and shrinks to one line only when that is too little (deck-fit, globals.css). */}
        {deckSize(overview.step?.kind ?? null, overview.suggestion?.status === "ok", Boolean(overview.toReview)) === "teaser" ? (
          <div className="deck-fit">
            <div className="deck-full">
              <SwipeDeck {...deck} partnerName={ctx.partner.name} compact />
            </div>
            <div className="deck-teaser">
              <SwipeTeaser count={deck.cards.length} />
            </div>
          </div>
        ) : (
          <SwipeDeck {...deck} partnerName={ctx.partner.name} compact />
        )}
      </>
    );
  }
  const back = (
    <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
      {reschedule || roundDate ? "← Doch nicht" : "← Zurück"}
    </Link>
  );

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
      setting: idea.setting,
      category: idea.category,
      note: idea.note,
      url: idea.url,
      matched: matched.has(idea.id),
      overBudget: Boolean(budget && budgetHint(idea.costEur, budget.left)),
      creator: idea.createdById ? (people[idea.createdById] ?? null) : null,
    }));

  if (roundDate && nextInfo) {
    return <PlanFlow mode={{ kind: "swap", next: { ...nextInfo, ideaId: roundDate.ideaId } }} ideas={ideas} partnerName={ctx.partner.name} aiEnabled={env().ai} intro={back} />;
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
        {back}
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
        <>
          {back}
          {!reschedule && roundInfo}
        </>
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
