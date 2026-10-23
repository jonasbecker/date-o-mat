import Link from "next/link";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import type { DatePlan } from "@/server/db/schema";
import { OpenReviewOnce } from "./open-review-once";

/**
 * "wie war's?" on the Beet (ARCHIV.md §3): the date (with its first photo, if there is one) and the way to the page.
 * The first time the app is opened after the date it goes there by itself (`OpenReviewOnce`); the hint stays here
 * until it is filled in.
 */
export function StartReview({ date, photoId, small = false }: { date: Pick<DatePlan, "id" | "title" | "startsAt" | "endsAt" | "location">; photoId?: string; small?: boolean }) {
  return (
    <div data-review-start={date.id} className="flex items-center gap-3">
      {photoId && (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from our own photo route
        <img src={`/api/photos/${photoId}?size=thumb`} alt="" className={small ? "size-12 shrink-0 rounded-xl object-cover" : "size-[72px] shrink-0 rounded-[16px] object-cover"} />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="leading-tight">
          <p className={small ? "truncate font-semibold" : "truncate text-[19px] font-bold"}>{date.title}</p>
          <p className="text-sm text-muted">
            {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
          </p>
        </div>
        <Link href={`/dates/${date.id}/wie-wars`} className="tap inline-flex h-10 items-center self-start rounded-full bg-cta px-4 text-[15px] font-bold text-[#111A14]">
          wie war’s? ›
        </Link>
      </div>
      <OpenReviewOnce dateId={date.id} />
    </div>
  );
}
