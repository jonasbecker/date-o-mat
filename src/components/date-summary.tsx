import Link from "next/link";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import type { DatePlan } from "@/server/db/schema";
import { Card, Chip } from "./card";
import { CalendarIcon, CardsIcon, PinIcon } from "./icons";

/**
 * The next date in short on the start page; everything else (checklist, route,
 * conversation cards, ändern, absagen) is one tap away on its own page.
 */
export function DateSummary({ date, hidden, today }: { date: DatePlan; hidden: boolean; today: boolean }) {
  return (
    <Card size="sm" className="flex flex-col gap-1.5" data-date-card={date.id}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold text-muted">Euer nächstes Date</p>
        <Chip className={date.status === "confirmed" ? "bg-minze text-tinte" : "bg-zitrone text-tinte"}>{date.status === "confirmed" ? "Bestätigt" : "Geplant"}</Chip>
      </div>
      <h2 className="text-[21px] font-bold leading-tight">{date.title}</h2>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-bold">
        <span className="flex items-center gap-1.5">
          <CalendarIcon width={16} height={16} /> {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
        </span>
        {date.location && (
          <span className="flex items-center gap-1.5">
            <PinIcon width={16} height={16} /> {date.location}
          </span>
        )}
      </p>
      {hidden && (
        <p className="text-sm font-semibold text-muted">
          🤫 Was es ist, erfährst du am Tag selbst.{date.note ? ` Hinweis: ${date.note}` : ""}
        </p>
      )}
      {date.syncStatus === "error" && (
        <p className="rounded-xl bg-zitrone-soft px-3 py-1.5 text-[13px] font-bold text-tinte">Google Kalender hakt gerade – der Date-O-Mat versucht es automatisch nochmal.</p>
      )}
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dates/${date.id}`} className="text-sm font-extrabold underline">
          Mehr zum Date →
        </Link>
        {today && (
          <Link href="/fragen" className="flex items-center gap-1.5 text-sm font-extrabold underline">
            <CardsIcon width={16} height={16} /> Gesprächskarten
          </Link>
        )}
      </div>
    </Card>
  );
}
