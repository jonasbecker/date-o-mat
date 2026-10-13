import Link from "next/link";
import { cancelDateAction, confirmDateAction } from "@/app/(app)/actions";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import type { DatePlan, User } from "@/server/db/schema";
import { buttonClass } from "./button";
import { Card, Chip } from "./card";
import { CancelDateButton } from "./cancel-date-button";
import { ConfettiActionButton } from "./confetti";
import { CalendarIcon, ClockIcon } from "./icons";
import { SizeChip } from "./size-chip";

function SyncHint({ date }: { date: DatePlan }) {
  if (date.syncStatus === "synced") {
    return <p className="rounded-xl bg-minze-soft px-3 py-2 text-[13px] font-bold text-tinte">✓ Steht in euren Google-Kalendern.</p>;
  }
  if (date.syncStatus === "pending") {
    return <p className="text-[13px] font-bold text-muted">Wird gerade in Google Kalender eingetragen …</p>;
  }
  return (
    <p className="rounded-xl bg-zitrone-soft px-3 py-2 text-[13px] font-bold text-tinte">
      Google Kalender hakt gerade – der Date-O-Mat versucht es automatisch nochmal.
    </p>
  );
}

/** The upcoming date with the actions that fit the viewer's role. */
export function DateCard({ date, me, partner }: { date: DatePlan; me: User; partner: User }) {
  const proposer = date.proposedById === me.id ? me : partner;
  const canConfirm = date.status === "planned" && date.proposedById !== me.id;

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Euer nächstes Date</p>
        <Chip className={date.status === "confirmed" ? "bg-minze text-tinte" : "bg-zitrone text-tinte"}>
          {date.status === "confirmed" ? "Bestätigt" : "Geplant"}
        </Chip>
      </div>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[24px] font-bold leading-tight">{date.title}</h2>
        <SizeChip size={date.size} className="mt-1.5 shrink-0" />
      </div>
      <div className="flex flex-col gap-1.5 font-bold">
        <span className="flex items-center gap-2">
          <CalendarIcon width={19} height={19} /> {formatLongDate(date.startsAt)}
        </span>
        <span className="flex items-center gap-2">
          <ClockIcon width={19} height={19} /> {formatTimeRange(date.startsAt, date.endsAt)} Uhr
        </span>
        {date.location && <span>📍 {date.location}</span>}
        {date.note && <span className="font-semibold text-muted">„{date.note}“</span>}
        {date.url && (
          <a href={date.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
            🔗 Link zur Idee
          </a>
        )}
      </div>
      <SyncHint date={date} />

      {canConfirm ? (
        <div className="flex flex-col gap-2.5">
          <p className="font-bold">{proposer.name} hat das geplant. Passt dir das?</p>
          <ConfettiActionButton action={confirmDateAction.bind(null, date.id)} className="w-full">
            Passt! 💚
          </ConfettiActionButton>
          <Link href={`/plan?reschedule=${date.id}`} className={buttonClass("secondary", "md", "w-full")}>
            Anderen Termin vorschlagen
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {date.status === "planned" && (
            <p className="font-bold text-muted">Wartet auf {partner.name}s „Passt!“</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/plan?reschedule=${date.id}`} className={buttonClass("secondary", "sm")}>
              Ändern
            </Link>
            <CancelDateButton action={cancelDateAction.bind(null, date.id)} partnerName={partner.name} />
          </div>
        </div>
      )}
    </Card>
  );
}
