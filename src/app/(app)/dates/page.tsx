import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { Mascot } from "@/components/mascot";
import { CardsIcon, HeartIcon, SparkleIcon } from "@/components/icons";
import { Avatar } from "@/components/avatar";
import { CycleHistory } from "@/components/cycle";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { cycleHistory } from "@/server/cycles";
import { Hearts } from "@/components/hearts";
import { reviewStats, visibleRatings, visibleReviews } from "@/core/reviews";
import { formatShortDate } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import type { User } from "@/server/db/schema";
import { pastDates, type PastDate } from "@/server/reviews";
import { coverPhotos } from "@/server/photos";
import { extraOn, getCoupleSettings } from "@/server/settings";
import { STORY_MIN_DATES } from "@/core/story";

/** Dates per page – the history is paged instead of scrolled. */
const PAGE_SIZE = 4;

export default function DatesPage({ searchParams }: PageProps<"/dates">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dates searchParams={searchParams} />
    </Suspense>
  );
}

async function Dates({ searchParams }: { searchParams: PageProps<"/dates">["searchParams"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const [dates, history, upcoming] = await Promise.all([pastDates(coupleId), cycleHistory(coupleId), upcomingDate(coupleId, now)]);
  const next = upcoming && dateForViewer(upcoming, user.id, [user, partner], now);
  const covers = await coverPhotos(coupleId, dates.map((d) => d.id));
  const pages = Math.max(1, Math.ceil(dates.length / PAGE_SIZE));
  const { page: pageParam } = await searchParams;
  const page = Math.min(pages, Math.max(1, Number(typeof pageParam === "string" ? pageParam : 1) || 1));
  const shown = dates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = reviewStats(
    dates.map((d) => ({ id: d.id, title: d.title, startsAt: d.startsAt, ratings: visibleRatings(d.reviews, user.id) })),
    now,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AutoRefresh />
      <AppHeader current="dates" />
      <h1 className="-mt-1 text-[26px] font-bold leading-tight">Eure Dates</h1>
      {/* What is coming up lives on the start page; here: what you had. */}
      {next && (
        <Link href="/plan" className="press flex items-center gap-2.5 rounded-[18px] border-2 border-line bg-surface px-3.5 py-2 text-sm font-bold">
          <span aria-hidden="true">📅</span>
          <span className="min-w-0 flex-1 truncate">
            Als Nächstes: {next.title} · {formatShortDate(next.startsAt)}
          </span>
          <span className="underline">ansehen</span>
        </Link>
      )}
      {history.length > 0 && <CycleHistory history={history} currentId={history.at(-1)!.id} />}

      {dates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-8 text-center">
          <Mascot id="no-dates" size={64} />
          <p className="font-display text-xl font-semibold">Hier sammeln sich eure Dates</p>
          <p className="font-semibold text-muted">Nach jedem Date könnt ihr Herzen vergeben und festhalten, was schön war.</p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2">
            <Stat label="Dates" value={String(stats.count)} tone="bg-minze" />
            <Stat label="Ø Herzen" value={stats.averageRating?.toLocaleString("de-DE") ?? "–"} tone="bg-himbeere-soft" />
            <Stat label="dieses Jahr" value={String(stats.thisYear)} tone="bg-zitrone-soft" />
          </dl>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-extrabold">
            {extraOn(settings, "story") && dates.length >= STORY_MIN_DATES && (
              <Link href="/story" aria-label="Eure Date-Story: Euer Jahr zum Durchtippen" className="flex items-center gap-1 underline">
                <SparkleIcon width={15} height={15} /> Date-Story
              </Link>
            )}
            {stats.favorite && (
              <Link href={`/dates/${stats.favorite.id}`} aria-label={`Euer Lieblingsdate: ${stats.favorite.title}`} className="flex items-center gap-1 underline">
                <HeartIcon width={15} height={15} /> Lieblingsdate
              </Link>
            )}
            {extraOn(settings, "cards") && (
              <Link href="/fragen" className="flex items-center gap-1 underline">
                <CardsIcon width={15} height={15} /> Gesprächskarten
              </Link>
            )}
          </div>
          <h2 className="-mb-1 text-[19px] font-semibold">Bisher</h2>
          <ul className="grid grid-cols-2 gap-2">
            {shown.map((date) => (
              <li key={date.id}>
                <DateRow date={date} me={user} partner={partner} cover={covers.get(date.id)} />
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Seiten" className="mt-auto flex items-center justify-between text-sm font-extrabold">
              {page > 1 ? (
                <Link href={page === 2 ? "/dates" : `/dates?page=${page - 1}`} className="underline">
                  ← Neuere
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted">
                Seite {page} von {pages}
              </span>
              {page < pages ? (
                <Link href={`/dates?page=${page + 1}`} className="underline">
                  Ältere →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`flex flex-col items-center rounded-[16px] border-2 border-line px-2 py-1.5 text-tinte ${tone}`}>
      <dt className="order-2 text-[11px] font-extrabold">{label}</dt>
      <dd className="font-display text-[22px] font-bold leading-none">{value}</dd>
    </div>
  );
}

/** A photo first – the history reads like an album, not like a list. */
function DateRow({ date, me, partner, cover }: { date: PastDate; me: User; partner: User; cover?: string }) {
  const { mine, partner: theirs, partnerHidden } = visibleReviews(date.reviews, me.id);
  return (
    <Link href={`/dates/${date.id}`} className="flat tap relative flex h-full flex-col overflow-hidden rounded-[18px] bg-surface">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- private photo route
        <img src={`/api/photos/${cover}?size=thumb`} alt="" loading="lazy" className="aspect-[16/9] w-full border-b-2 border-line object-cover" />
      ) : (
        <span className="flex aspect-[16/9] w-full items-center justify-center border-b-2 border-line bg-bg">
          <Mascot id={`date-${date.id}`} size={40} />
        </span>
      )}
      {!mine && <span className="absolute right-1.5 top-1.5 rounded-full border-2 border-line bg-himbeere px-2 py-px text-[11px] font-extrabold text-tinte">Bewerten</span>}
      <span className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
        <span className="truncate font-display text-[15px] font-semibold leading-snug">{date.title}</span>
        <span className="truncate text-[11px] font-extrabold text-muted">{formatShortDate(date.startsAt)}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <PersonHearts person={me} rating={mine?.rating ?? null} />
          {partnerHidden ? (
            <span className="flex items-center gap-1 text-[11px] font-extrabold text-muted">
              <Avatar person={partner} size={16} /> hat bewertet 🔒
            </span>
          ) : (
            <PersonHearts person={partner} rating={theirs?.rating ?? null} />
          )}
        </span>
      </span>
    </Link>
  );
}

function PersonHearts({ person, rating }: { person: User; rating: number | null }) {
  return (
    <span className="flex items-center gap-1">
      <Avatar person={person} size={16} />
      {rating ? <Hearts rating={rating} size={11} /> : <span className="text-[11px] font-extrabold text-muted">offen</span>}
    </span>
  );
}
