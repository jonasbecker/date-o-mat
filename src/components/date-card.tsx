import Link from "next/link";
import { cancelDateAction, confirmDateAction } from "@/app/(app)/actions";
import { formatLongDate, formatShortDate, formatTimeRange, genitive } from "@/lib/format";
import type { DatePlan, User } from "@/server/db/schema";
import { buttonClass } from "./button";
import { Card, Chip } from "./card";
import { CancelDateButton } from "./cancel-date-button";
import { ConfettiActionButton } from "./confetti";
import { CalendarIcon, ClockIcon, PinIcon } from "./icons";
import { SizeChip } from "./size-chip";
import { ConversationCards } from "./conversation-cards";
import { DateChecklist, type TaskView } from "./date-checklist";
import { routeUrl } from "@/core/date-extras";

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

export type DateCardExtras = {
  /** Preparation checklist (null = not shown, e.g. a surprise for me). */
  tasks: TaskView[] | null;
  suggestions: string[];
  /** The date is today: conversation cards. */
  isToday: boolean;
  /** "organizer": I planned a surprise · "hidden": it's a surprise for me. */
  surprise: "organizer" | "hidden" | null;
};

/** The upcoming date with the actions that fit the viewer's role. */
export function DateCard({
  date,
  me,
  partner,
  showConfirm = true,
  extras,
  compact = false,
}: {
  date: DatePlan;
  me: User;
  partner: User;
  showConfirm?: boolean;
  extras?: DateCardExtras;
  /** On the start page: everything, but in fewer lines (one screen). */
  compact?: boolean;
}) {
  const proposer = date.proposedById === me.id ? me : partner;
  // On the home screen the "Passt!" button already sits in the next-step card above.
  const canConfirm = showConfirm && date.status === "planned" && date.proposedById !== me.id;

  const surpriseNote =
    extras?.surprise === "hidden"
      ? `🤫 ${partner.name} hat eine Überraschung geplant – was es ist, erfährst du am Tag selbst.`
      : extras?.surprise === "organizer"
        ? `🎁 Überraschung: ${partner.name} sieht bis zum Tag selbst nur Zeit${date.surpriseHint ? " und deinen Hinweis" : ""} – auch im Google-Kalender.`
        : null;

  return (
    <Card size={compact ? "sm" : "lg"} className={compact ? "flex flex-col gap-2" : "flex flex-col gap-4"} data-date-card={date.id}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-extrabold text-muted">Euer nächstes Date</p>
        <Chip className={date.status === "confirmed" ? "bg-minze text-tinte" : "bg-zitrone text-tinte"}>
          {date.status === "confirmed" ? "Bestätigt" : "Geplant"}
        </Chip>
      </div>
      <div className="flex items-start justify-between gap-3">
        <h2 className={compact ? "text-[21px] font-bold leading-tight" : "text-[24px] font-bold leading-tight"}>{date.title}</h2>
        <SizeChip size={date.size} className="mt-1 shrink-0" />
      </div>
      <div className={compact ? "flex flex-col gap-1 text-sm font-bold" : "flex flex-col gap-1.5 font-bold"}>
        {compact ? (
          <span className="flex items-center gap-2">
            <CalendarIcon width={17} height={17} /> {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <CalendarIcon width={19} height={19} /> {formatLongDate(date.startsAt)}
            </span>
            <span className="flex items-center gap-2">
              <ClockIcon width={19} height={19} /> {formatTimeRange(date.startsAt, date.endsAt)} Uhr
            </span>
          </>
        )}
        {date.location && (
          <span className="flex flex-wrap items-center gap-x-3">
            <span className="flex items-center gap-2">
              <PinIcon width={compact ? 17 : 19} height={compact ? 17 : 19} /> {date.location}
            </span>
            <a href={routeUrl(date.location, me.startLocation)} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              Route (ÖPNV)
            </a>
          </span>
        )}
        {date.note && (
          <span className={compact ? "line-clamp-2 font-semibold text-muted" : "font-semibold text-muted"}>
            {extras?.surprise === "hidden" ? `Hinweis: ${date.note}` : `„${date.note}“`}
          </span>
        )}
        {date.url && (
          <a href={date.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
            🔗 Link zur Idee
          </a>
        )}
      </div>
      {surpriseNote && <p className="rounded-xl bg-himbeere-soft px-3 py-2 text-[13px] font-bold text-tinte">{surpriseNote}</p>}
      {/* On the start page only a problem with Google is worth a line. */}
      {(!compact || date.syncStatus !== "synced") && <SyncHint date={date} />}
      {extras?.tasks && <DateChecklist dateId={date.id} tasks={extras.tasks} suggestions={extras.suggestions} collapsed={compact} />}
      {extras?.isToday && <ConversationCards compact={compact} />}

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
          {/* On the home screen the next-step card above already says this. */}
          {showConfirm && date.status === "planned" && date.proposedById === me.id && (
            <p className="font-bold text-muted">Wartet auf {genitive(partner.name)} „Passt!“</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/plan?reschedule=${date.id}`} className={buttonClass("secondary", "sm")}>
              {compact ? "Zeit ändern" : "Ändern"}
            </Link>
            <CancelDateButton action={cancelDateAction.bind(null, date.id)} partnerName={partner.name} />
          </div>
        </div>
      )}
    </Card>
  );
}
