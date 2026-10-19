import Link from "next/link";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { RATING_MAX } from "@/lib/domain";
import type { DatePlan } from "@/server/db/schema";
import { HeartShape } from "./hearts";

/**
 * "Wie war's?" inside the step card: the date (with its first photo, if there is one) and
 * five hearts. A tap on a heart opens the review with that number already chosen.
 */
export function StartReview({ date, photoId }: { date: Pick<DatePlan, "id" | "title" | "startsAt" | "endsAt" | "location">; photoId?: string }) {
  return (
    <div data-review-start={date.id} className="flex items-center gap-3">
      {photoId && (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnails come from our own photo route
        <img src={`/api/photos/${photoId}?size=thumb`} alt="" className="size-[72px] shrink-0 rounded-[16px] border-2 border-line object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="font-bold leading-tight">
          <p className="truncate font-display text-[19px] font-semibold">„{date.title}“</p>
          <p className="text-sm">
            {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
          </p>
        </div>
        <div className="flex gap-0.5" role="group" aria-label="Wie viele Herzen?">
          {Array.from({ length: RATING_MAX }, (_, i) => {
            const value = i + 1;
            return (
              <Link key={value} href={`/dates/${date.id}?herzen=${value}`} aria-label={`${value} ${value === 1 ? "Herz" : "Herzen"}`} className="press rounded-full p-0.5">
                <HeartShape filled={false} size={34} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
