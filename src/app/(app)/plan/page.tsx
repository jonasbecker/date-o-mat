import { Suspense } from "react";
import { ConnectCalendarCard } from "@/components/connect-calendar";
import { formatShortDate, slotView } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { searchSlots } from "@/server/availability";
import { SlotPicker } from "./slot-picker";

export default function PlanPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[30px] font-bold leading-tight">Date planen</h1>
        <p className="font-bold text-muted">Wann habt ihr beide Zeit?</p>
      </div>
      <Suspense fallback={<SlotsSkeleton />}>
        <Plan />
      </Suspense>
    </div>
  );
}

async function Plan() {
  const ctx = await requireCouple();
  const search = await searchSlots(ctx, new Date());

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
      {search.failedCalendars > 0 && (
        <p className="rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3 text-sm font-bold text-tinte">
          {search.failedCalendars === 1 ? "Ein Kalender konnte" : `${search.failedCalendars} Kalender konnten`} nicht gelesen
          werden und zählen gerade nicht mit. Prüft die Auswahl in den Einstellungen.
        </p>
      )}
      <SlotPicker
        small={search.small.map(slotView)}
        large={search.large.map(slotView)}
        untilLabel={formatShortDate(search.until)}
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
