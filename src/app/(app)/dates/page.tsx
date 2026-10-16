import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { CycleHistory } from "@/components/cycle";
import { cycleHistory } from "@/server/cycles";
import { Hearts } from "@/components/hearts";
import { reviewStats, visibleRatings, visibleReviews } from "@/core/reviews";
import { formatLongDate } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import type { User } from "@/server/db/schema";
import { pastDates, type PastDate } from "@/server/reviews";
import { coverPhotos } from "@/server/photos";
import { extraOn, getCoupleSettings } from "@/server/settings";
import { STORY_MIN_DATES } from "@/core/story";

export default function DatesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dates />
    </Suspense>
  );
}

async function Dates() {
  const { user, partner, coupleId } = await requireCouple();
  await connection();
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const [dates, history] = await Promise.all([pastDates(coupleId), cycleHistory(coupleId)]);
  const covers = await coverPhotos(coupleId, dates.map((d) => d.id));
  const stats = reviewStats(
    dates.map((d) => ({ id: d.id, title: d.title, startsAt: d.startsAt, ratings: visibleRatings(d.reviews, user.id) })),
    now,
  );

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <h1 className="text-[30px] font-bold">Unsere Dates</h1>
      {history.length > 0 && <CycleHistory history={history} currentId={history.at(-1)!.id} />}

      {dates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-10 text-center">
          <span className="text-5xl" aria-hidden="true">
            📸
          </span>
          <p className="font-display text-xl font-semibold">Hier sammeln sich eure Dates</p>
          <p className="font-semibold text-muted">Nach jedem Date könnt ihr Herzen vergeben und festhalten, was schön war.</p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2.5">
            <Stat label="Dates" value={String(stats.count)} tone="bg-minze" />
            <Stat label="Ø Herzen" value={stats.averageRating?.toLocaleString("de-DE") ?? "–"} tone="bg-himbeere-soft" />
            <Stat label="dieses Jahr" value={String(stats.thisYear)} tone="bg-zitrone-soft" />
          </dl>
          {extraOn(settings, "story") && dates.length >= STORY_MIN_DATES && (
          <Link href="/story" className="press sticker flex items-center gap-3 rounded-[22px] bg-himbeere px-4 py-3.5 text-tinte">
            <span className="text-3xl" aria-hidden="true">
              📖
            </span>
            <span className="flex flex-col">
              <span className="font-display text-lg font-semibold leading-snug">Eure Date-Story</span>
              <span className="text-sm font-bold">Euer Jahr zum Durchtippen – Lieblingsdate, Herzen, Fotos …</span>
            </span>
          </Link>
          )}
          {extraOn(settings, "cards") && (
            <Link href="/fragen" className="self-start text-sm font-extrabold underline">
              💬 Gesprächskarten für euer nächstes Date
            </Link>
          )}
          {stats.favorite && (
            <Link
              href={`/dates/${stats.favorite.id}`}
              className="press sticker flex items-center gap-3 rounded-[22px] bg-lavendel px-4 py-3.5 text-tinte"
            >
              <span className="text-3xl" aria-hidden="true">
                🏆
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] font-extrabold uppercase tracking-wide">Euer Lieblingsdate</span>
                <span className="font-display text-lg font-semibold leading-snug">{stats.favorite.title}</span>
              </span>
            </Link>
          )}
          <ul className="flex flex-col gap-3.5">
            {dates.map((date) => (
              <li key={date.id}>
                <DateRow date={date} me={user} partner={partner} cover={covers.get(date.id)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`sticker flex flex-col items-center rounded-[20px] px-2 py-3 text-tinte ${tone}`}>
      <dt className="order-2 text-xs font-extrabold">{label}</dt>
      <dd className="font-display text-[28px] font-bold leading-none">{value}</dd>
    </div>
  );
}

function DateRow({ date, me, partner, cover }: { date: PastDate; me: User; partner: User; cover?: string }) {
  const { mine, partner: theirs, partnerHidden } = visibleReviews(date.reviews, me.id);
  return (
    <Link href={`/dates/${date.id}`} className="press sticker flex flex-col gap-2 overflow-hidden rounded-[20px] bg-surface p-3.5">
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- private photo route
        <img src={`/api/photos/${cover}?size=thumb`} alt="" loading="lazy" className="-mx-3.5 -mt-3.5 mb-1 h-36 w-[calc(100%+1.75rem)] max-w-none border-b-2 border-line object-cover" />
      )}
      <span className="flex items-start justify-between gap-3">
        <span className="font-display text-lg font-semibold leading-snug">{date.title}</span>
        {!mine && <span className="shrink-0 rounded-full border-2 border-line bg-himbeere px-2.5 py-0.5 text-xs font-extrabold text-tinte">Bewerten</span>}
      </span>
      <span className="text-[13px] font-extrabold text-muted">
        {formatLongDate(date.startsAt)}
        {date.location && ` · 📍 ${date.location}`}
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <PersonHearts person={me} rating={mine?.rating ?? null} />
        {partnerHidden ? (
          <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-muted">
            <Avatar person={partner} size={22} /> hat bewertet 🔒
          </span>
        ) : (
          <PersonHearts person={partner} rating={theirs?.rating ?? null} />
        )}
      </span>
    </Link>
  );
}

function PersonHearts({ person, rating }: { person: User; rating: number | null }) {
  return (
    <span className="flex items-center gap-1.5">
      <Avatar person={person} size={22} />
      {rating ? <Hearts rating={rating} size={16} /> : <span className="text-[13px] font-extrabold text-muted">noch offen</span>}
    </span>
  );
}
