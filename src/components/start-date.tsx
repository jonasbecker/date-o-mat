import Link from "next/link";
import { confirmDateAction } from "@/app/(app)/actions";
import { routeUrl } from "@/core/date-extras";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import type { DatePlan, User } from "@/server/db/schema";
import { ConfettiActionButton } from "./confetti";
import { CalendarIcon, PinIcon, SwapIcon } from "./icons";

/**
 * The next date inside the step card on the start page: what, when, where –
 * "Passt!" when it is yours to say. Checklist, changing and cancelling sit
 * one tap away under "Details".
 */
export function StartDate({
  date,
  me,
  partner,
  surprise,
  swappable,
  isToday = false,
}: {
  date: DatePlan;
  me: User;
  partner: User;
  /** "hidden": a surprise for me · "organizer": I planned one. */
  surprise: "hidden" | "organizer" | null;
  /** "Lieber was anderes?" – the idea can be swapped (not someone else's surprise). */
  swappable: boolean;
  /** The date is today: the conversation cards are one tap away. */
  isToday?: boolean;
}) {
  const confirmable = date.status === "planned" && date.proposedById !== me.id;
  return (
    <>
      <div data-date-card={date.id} className="flex flex-col gap-1 font-bold">
        <p className="font-display text-[19px] font-semibold leading-tight">„{date.title}“</p>
        <p className="flex items-center gap-2">
          <CalendarIcon width={17} height={17} /> {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
        </p>
        {date.location && (
          <p className="flex flex-wrap items-center gap-x-2">
            <span className="flex min-w-0 items-center gap-2">
              <PinIcon width={17} height={17} className="shrink-0" /> <span className="truncate">{date.location}</span>
            </span>
            <a href={routeUrl(date.location, me.startLocation)} target="_blank" rel="noopener noreferrer" className="underline">
              Route (ÖPNV)
            </a>
          </p>
        )}
        {surprise === "hidden" && (
          <p>
            🤫 Eine Überraschung von {partner.name} – mehr erfährst du am Tag selbst.{date.note ? ` Hinweis: ${date.note}` : ""}
          </p>
        )}
        {surprise === "organizer" && <p>🎁 Überraschung: {partner.name} sieht bis zum Tag nur die Zeit.</p>}
        {date.syncStatus === "error" && <p>Google Kalender hakt gerade – der Date-O-Mat versucht es nochmal.</p>}
      </div>
      {confirmable && (
        <ConfettiActionButton action={confirmDateAction.bind(null, date.id)} className="w-full">
          Passt! 💚
        </ConfettiActionButton>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-extrabold">
        <Link href={`/dates/${date.id}`} className="underline">
          Details ›
        </Link>
        {isToday && (
          <Link href="/fragen" className="underline">
            💬 Gesprächskarten
          </Link>
        )}
        {swappable && (
          <Link href="/plan?pick=1" className="flex items-center gap-1.5 underline">
            <SwapIcon width={16} height={16} /> Lieber was anderes?
          </Link>
        )}
      </div>
    </>
  );
}
