import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { formatShortDate, slotView } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { searchSlots } from "@/server/availability";
import { coupleNow } from "@/server/clock";
import { activeDateOf, ensureCurrentCycle } from "@/server/cycles";
import { getCoupleSettings } from "@/server/settings";
import { env } from "@/server/env";
import { searchUntil } from "@/server/suggestions";
import { formatCost } from "@/lib/idea-input";
import { getDate } from "@/server/dates";
import { ideaCandidates } from "@/server/idea-sources";
import { PlanForm, type IdeaOption, type RescheduleInfo } from "./plan-form";

export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[30px] font-bold leading-tight">Date planen</h1>
        <p className="font-bold text-muted">Zeit und Idee wählen – fertig.</p>
        <Link href="/events?free=1" className="text-sm font-extrabold underline">
          🎟️ Oder ein Event, bei dem ihr beide Zeit habt
        </Link>
      </div>
      <Suspense fallback={<SlotsSkeleton />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Plan({ searchParams }: { searchParams: PageProps<"/plan">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const settings = await getCoupleSettings(ctx.coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  const params = await searchParams;
  const later = params.later === "1";
  const rescheduleId = typeof params.reschedule === "string" ? params.reschedule : undefined;
  // An explicit ?reschedule=…, or – if this round already has a date – that one.
  const existing =
    rescheduleId && /^[0-9a-f-]{36}$/.test(rescheduleId)
      ? await getDate(ctx.coupleId, rescheduleId)
      : cycle && (cycle.status === "planned" || cycle.status === "confirmed")
        ? await activeDateOf(cycle.id)
        : undefined;
  const reschedule: RescheduleInfo | undefined =
    existing && (existing.status === "planned" || existing.status === "confirmed")
      ? { dateId: existing.id, size: existing.size, ideaId: existing.ideaId, title: existing.title, location: existing.location }
      : undefined;
  // Normally only within the current round; "later" searches the whole horizon.
  const until = cycle && !later ? searchUntil(cycle, now, settings.horizonDays) : undefined;
  const search = await searchSlots(ctx, now, until);
  const roundInfo = cycle && (
    <p className="-mt-3 text-sm font-extrabold text-muted">
      {reschedule ? "Termin ändern · " : ""}Runde {cycle.seq}
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

  // Longest waiting first – the same order the suggestion mode uses.
  const ideas: IdeaOption[] = (await ideaCandidates({ coupleId: ctx.coupleId }))
    .filter((c) => c.ideaId)
    .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
    .map((c) => ({
      id: c.ideaId!,
      title: c.title,
      size: c.size,
      meta: [formatCost(c.costEur), c.location && `📍 ${c.location}`].filter(Boolean).join(" · ") || null,
    }));

  if (search.status === "not_connected") return <ConnectCalendarCard people={search.people} next="/plan" />;
  if (search.status === "google_error") {
    return (
      <p role="alert" className="rounded-[20px] border-2 border-line bg-himbeere-soft px-4 py-3 font-bold text-tinte">
        Google Kalender antwortet gerade nicht. Versuch es in einer Minute nochmal.
      </p>
    );
  }

  return (
    <>
      {roundInfo}
      {search.failedCalendars > 0 && (
        <p className="rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3 text-sm font-bold text-tinte">
          {search.failedCalendars === 1 ? "Ein Kalender konnte" : `${search.failedCalendars} Kalender konnten`} nicht gelesen
          werden und zählen gerade nicht mit. Prüft die Auswahl in den Einstellungen.
        </p>
      )}
      <PlanForm
        small={search.small.map(slotView)}
        large={search.large.map(slotView)}
        ideas={ideas}
        untilLabel={formatShortDate(search.until)}
        partnerName={ctx.partner.name}
        reschedule={reschedule}
        searchScopeLink={scopeLink}
        preselectIdeaId={typeof params.idea === "string" ? params.idea : undefined}
        aiEnabled={env().ai}
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
