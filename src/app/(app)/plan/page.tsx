import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { formatShortDate, formatTimeRange, slotView } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { searchSlots } from "@/server/availability";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { extraOn, getCoupleSettings } from "@/server/settings";
import { env } from "@/server/env";
import { periodLabel } from "@/core/next-step";
import { freeForEvents, listSources, savedRefs, upcomingEvents } from "@/server/events";
import type { EventView } from "../events/event-list";
import { eventView } from "../events/event-view";
import { searchUntil } from "@/server/suggestions";
import { formatCost } from "@/lib/idea-input";
import { budgetState } from "@/server/budget";
import { budgetHint } from "@/core/budget";
import { BudgetBar } from "@/components/budget-bar";
import { countDoneDates, dateForViewer, getDate } from "@/server/dates";
import { ideaCandidates } from "@/server/idea-sources";
import { PlanFlow, type IdeaOption, type RescheduleInfo } from "./plan-form";
import { AppHeader } from "@/components/app-header";
import { loadOverview, StartSection } from "../overview";
import { AutoRefresh } from "@/components/auto-refresh";
import { buttonClass } from "@/components/button";
import type { NextDateInfo } from "@/components/swap-confirm";

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <div className="flex flex-col gap-5">
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
  const top = (afterDate?: React.ReactNode) => (
    <>
      <AutoRefresh />
      <StartSection o={overview} ctx={ctx} now={now} afterDate={afterDate} />
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
  // Longest waiting first – the same order the suggestion mode uses.
  const ideas: IdeaOption[] = (await ideaCandidates({ coupleId: ctx.coupleId }))
    .filter((c) => c.ideaId)
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
    .map((c) => ({
      id: c.ideaId!,
      title: c.title,
      size: c.size,
      costEur: c.costEur,
      meta:
        [formatCost(c.costEur), c.location && `📍 ${c.location}`, budget && budgetHint(c.costEur, budget.left) && "⚠️ über Budget"].filter(Boolean).join(" · ") ||
        null,
    }));

  if (roundDate) {
    if (!swappable || !nextInfo) return top();
    if (params.pick !== "1") {
      return top(
        <Link href="/plan?pick=1" className={buttonClass("secondary", "md", "-mt-2 w-full")}>
          🔄 Lieber was anderes machen?
        </Link>,
      );
    }
    return (
      <>
        {top()}
        <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
          ← Doch nicht
        </Link>
        <PlanFlow mode={{ kind: "swap", next: { ...nextInfo, ideaId: roundDate.ideaId } }} small={[]} large={[]} ideas={ideas} untilLabel="" partnerName={ctx.partner.name} aiEnabled={env().ai} />
      </>
    );
  }

  const heading = !reschedule && (
    <div>
      <h1 className="text-[30px] font-bold leading-tight">Date planen</h1>
      <p className="font-bold text-muted">Idee aussuchen, Zeit wählen – fertig.</p>
    </div>
  );
  // Normally only within the current round; "later" searches the whole horizon.
  const until = cycle && !later ? searchUntil(cycle, now, settings.horizonDays) : undefined;
  const search = await searchSlots(ctx, now, until);
  const roundInfo = cycle && (
    <p className="-mt-3 text-sm font-extrabold text-muted">
      {periodLabel(cycle.startsAt, cycle.endsAt)}
      {cycle.mode === "alternating" &&
        (cycle.plannerId === ctx.user.id ? " · du bist dran" : ` · ${ctx.partner.name} ist dran`)}
      {cycle.mode === "suggestion" && " · Vorschlag-Modus"}
    </p>
  );
  const scopeLink = cycle && (
    <Link
      href={`/plan?${new URLSearchParams({ ...(later ? {} : { later: "1" }), ...(reschedule ? { reschedule: reschedule.dateId } : {}), ...(typeof params.idea === "string" ? { idea: params.idea } : {}) })}`}
      className="self-center text-sm font-extrabold underline"
    >
      {later ? "Nur in dieser Runde suchen" : "Auch nach dem Rundenende suchen"}
    </Link>
  );

  // Events in the next weeks where both are free (null = no sources yet).
  let events: EventView[] | null = null;
  if (search.status === "ok" && !reschedule && (await listSources(ctx.coupleId)).length > 0) {
    const [list, saved] = await Promise.all([upcomingEvents(ctx.coupleId, now, settings.horizonDays), savedRefs(ctx.coupleId)]);
    const earliest = now.getTime() + 2 * 3_600_000; // same lead time as saving a date
    const plannable = list.filter((e) => e.startsAt && !e.allDay && e.startsAt.getTime() > earliest);
    const free = await freeForEvents(ctx, plannable);
    events = plannable.filter((e) => free?.get(e.id) === true).map((e) => eventView(e, { free: true, saved: saved.has(e.dedupeKey), now }));
  }

  if (search.status === "not_connected") {
    return (
      <>
        {top()}
        {heading}
        <ConnectCalendarCard people={search.people} next="/plan" />
      </>
    );
  }
  if (search.status === "google_error") {
    return (
      <>
        {top()}
        {heading}
        <p role="alert" className="rounded-[20px] border-2 border-line bg-himbeere-soft px-4 py-3 font-bold text-tinte">
          Google Kalender antwortet gerade nicht. Versuch es in einer Minute nochmal.
        </p>
      </>
    );
  }

  return (
    <>
      {top()}
      {reschedule && (
        <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
          ← Doch nicht
        </Link>
      )}
      {heading}
      {!reschedule && roundInfo}
      {search.failedCalendars > 0 && (
        <p className="rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3 text-sm font-bold text-tinte">
          {search.failedCalendars === 1 ? "Ein Kalender konnte" : `${search.failedCalendars} Kalender konnten`} nicht gelesen
          werden und zählen gerade nicht mit. Prüft die Auswahl in den Einstellungen.
        </p>
      )}
      <PlanFlow
        mode={reschedule ? { kind: "reschedule", date: reschedule } : { kind: "new" }}
        budget={budget && !reschedule ? { left: budget.left, pot: budget.pot } : null}
        budgetBar={budget && !reschedule && budget.level === "ok" ? <BudgetBar {...budget} compact /> : undefined}
        small={search.small.map(slotView)}
        large={search.large.map(slotView)}
        ideas={ideas}
        untilLabel={formatShortDate(search.until)}
        partnerName={ctx.partner.name}
        searchScopeLink={scopeLink}
        preselectIdeaId={typeof params.idea === "string" ? params.idea : undefined}
        preselectSize={params.size === "large" ? "large" : undefined}
        aiEnabled={env().ai}
        surpriseEnabled={extraOn(settings, "surprise") && doneDates > 0}
        events={events}
      />
    </>
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
