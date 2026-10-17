import Link from "next/link";
import { confirmDateAction } from "@/app/(app)/actions";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import type { DatePlan, User } from "@/server/db/schema";
import { Card, Chip } from "./card";
import { ConfettiActionButton } from "./confetti";

/**
 * The next date in short on the start page; everything else (checklist, route,
 * conversation cards, ändern, absagen) is one tap away on its own page.
 */
export function DateSummary({ date, me, showConfirm, hidden, today }: { date: DatePlan; me: User; showConfirm: boolean; hidden: boolean; today: boolean }) {
  const canConfirm = showConfirm && date.status === "planned" && date.proposedById !== me.id;
  return (
    <Card size="sm" className="flex flex-col gap-1.5" data-date-card={date.id}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Euer nächstes Date</p>
        <Chip className={date.status === "confirmed" ? "bg-minze text-tinte" : "bg-zitrone text-tinte"}>{date.status === "confirmed" ? "Bestätigt" : "Geplant"}</Chip>
      </div>
      <h2 className="text-[21px] font-bold leading-tight">{date.title}</h2>
      <p className="text-sm font-bold">
        📅 {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
        {date.location ? ` · 📍 ${date.location}` : ""}
      </p>
      {hidden && (
        <p className="text-sm font-semibold text-muted">
          🤫 Was es ist, erfährst du am Tag selbst.{date.note ? ` Hinweis: ${date.note}` : ""}
        </p>
      )}
      {date.syncStatus === "error" && (
        <p className="rounded-xl bg-zitrone-soft px-3 py-1.5 text-[13px] font-bold text-tinte">Google Kalender hakt gerade – der Date-O-Mat versucht es automatisch nochmal.</p>
      )}
      {canConfirm && (
        <ConfettiActionButton action={confirmDateAction.bind(null, date.id)} className="mt-1 w-full">
          Passt! 💚
        </ConfettiActionButton>
      )}
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dates/${date.id}`} className="text-sm font-extrabold underline">
          Mehr zum Date →
        </Link>
        {today && (
          <Link href="/fragen" className="text-sm font-extrabold underline">
            💬 Gesprächskarten
          </Link>
        )}
      </div>
    </Card>
  );
}
