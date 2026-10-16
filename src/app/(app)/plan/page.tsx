import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { formatShortDate, slotView } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { searchSlots } from "@/server/availability";
import { coupleNow } from "@/server/clock";
import { activeDateOf, ensureCurrentCycle } from "@/server/cycles";
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
import { PlanForm, type IdeaOption, type RescheduleInfo } from "./plan-form";
import { AppHeader } from "@/components/app-header";
import { loadOverview, RoundSection } from "../overview";

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<SlotsSkeleton />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const planHeading = (
  <div>
    <h1 className="text-[30px] font-bold leading-tight">Date planen</h1>
    <p className="font-bold text-muted">Zeit und Idee wählen – fertig.</p>
  </div>
);

async function Plan({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const settings = await getCoupleSettings(ctx.coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  const [params, overview] = await Promise.all([searchParams, loadOverview(ctx, settings, now)]);
  // Header and the state of the round ("Du bist dran", "Sam muss noch Passt! sagen") above the form.
  const top = (
    <>
      <AppHeader user={ctx.user} partner={ctx.partner} />
      <RoundSection o={overview} ctx={ctx} now={now} />
      {planHeading}
    </>
  );
  const later = params.later === "1";
  const rescheduleId = typeof params.reschedule === "string" ? params.reschedule : undefined;
  // An explicit ?reschedule=…, or – if this round already has a date – that one.
  const existing =
    rescheduleId && /^[0-9a-f-]{36}$/.test(rescheduleId)
      ? await getDate(ctx.coupleId, rescheduleId)
      : cycle && (cycle.status === "planned" || cycle.status === "confirmed")
        ? await activeDateOf(cycle.id)
        : undefined;
  // Moving someone else's surprise: the time changes, the secret stays.
  const shown = existing && dateForViewer(existing, ctx.user.id, [ctx.user, ctx.partner], now);
  const reschedule: RescheduleInfo | undefined =
    shown && (shown.status === "planned" || shown.status === "confirmed")
      ? { dateId: shown.id, size: shown.size, ideaId: shown === existing ? shown.ideaId : null, title: shown.title, location: shown.location, keepSecret: shown !== existing }
      : undefined;
  // Normally only within the current round; "later" searches the whole horizon.
  const until = cycle && !later ? searchUntil(cycle, now, settings.horizonDays) : undefined;
  const search = await searchSlots(ctx, now, until);
  const roundInfo = cycle && (
    <p className="-mt-3 text-sm font-extrabold text-muted">
      {reschedule ? "Termin ändern · " : ""}
      {periodLabel(cycle.startsAt, cycle.endsAt)}
      {cycle.mode === "alternating" &&
        (cycle.plannerId === ctx.user.id ? " · du bist dran" : ` · ${ctx.partner.name} ist dran`)}
      {cycle.mode === "suggestion" && " · Vorschlag-Modus"}
    </p>
  );
  const scopeLink = cycle && (
    <Link
      href={`/plan?${new URLSearchParams({ ...(later ? {} : { later: "1" }), ...(reschedule ? { reschedule: reschedule.dateId } : {}) })}`}
      className="self-center text-sm font-extrabold underline"
    >
      {later ? "Nur in dieser Runde suchen" : "Auch nach dem Rundenende suchen"}
    </Link>
  );

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

  // "🎟️ Events" tab: events in the next weeks where both are free (null = no sources yet).
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
        {top}
        <ConnectCalendarCard people={search.people} next="/plan" />
      </>
    );
  }
  if (search.status === "google_error") {
    return (
      <>
        {top}
        <p role="alert" className="rounded-[20px] border-2 border-line bg-himbeere-soft px-4 py-3 font-bold text-tinte">
          Google Kalender antwortet gerade nicht. Versuch es in einer Minute nochmal.
        </p>
      </>
    );
  }

  return (
    <>
      {top}
      {roundInfo}
      {search.failedCalendars > 0 && (
        <p className="rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3 text-sm font-bold text-tinte">
          {search.failedCalendars === 1 ? "Ein Kalender konnte" : `${search.failedCalendars} Kalender konnten`} nicht gelesen
          werden und zählen gerade nicht mit. Prüft die Auswahl in den Einstellungen.
        </p>
      )}
      {budget && !reschedule && <BudgetBar {...budget} compact />}
      <PlanForm
        budget={budget && !reschedule ? { left: budget.left, pot: budget.pot } : null}
        small={search.small.map(slotView)}
        large={search.large.map(slotView)}
        ideas={ideas}
        untilLabel={formatShortDate(search.until)}
        partnerName={ctx.partner.name}
        reschedule={reschedule}
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
