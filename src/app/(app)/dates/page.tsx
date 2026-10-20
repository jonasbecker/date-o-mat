import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DateTime } from "luxon";
import { AutoRefresh } from "@/components/auto-refresh";
import { Mascot } from "@/components/mascot";
import { AppHeader, HeaderMeta, PageSkeleton } from "@/components/app-header";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { visibleReviews } from "@/core/reviews";
import { APP_TIMEZONE, PERSON_HEX } from "@/lib/domain";
import { formatShortDate } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import type { User } from "@/server/db/schema";
import { pastDates, type PastDate } from "@/server/reviews";
import { coverPhotos } from "@/server/photos";
import { skippedRounds, type SkippedRound } from "@/server/plant";
import { getCoupleSettings } from "@/server/settings";

/** Tiles per page – the Archiv is paged instead of scrolled. */
const PAGE_SIZE = 4;

// Without a photo a tile is a pastel field with two soft shapes (as in MArchiv) – fixed light tones.
const TILES = [
  ["#DCE7F5", "#B9CDEB", "#F2A7BB"],
  ["#F7EBC4", "#EBD58F", "#E8A58D"],
  ["#E6E0F2", "#CBBFE6", "#BFDDB9"],
  ["#F6DFD3", "#E8A58D", "#163A22"],
  ["#DCEBD9", "#8FC79A", "#F7EBC4"],
];

/** MArchiv: "unser beet." – every date a tile with its photo, every round that fell through a wilted one. */
export default function DatesPage({ searchParams }: PageProps<"/dates">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Suspense
        fallback={
          <>
            <AppHeader />
            <PageSkeleton />
          </>
        }
      >
        <Dates searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Tile = { kind: "date"; at: Date; date: PastDate } | { kind: "skipped"; at: Date; round: SkippedRound };

async function Dates({ searchParams }: { searchParams: PageProps<"/dates">["searchParams"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const [dates, skipped, upcoming] = await Promise.all([pastDates(coupleId), skippedRounds(coupleId), upcomingDate(coupleId, now)]);
  const next = upcoming && dateForViewer(upcoming, user.id, [user, partner], now);
  const covers = await coverPhotos(coupleId, dates.map((d) => d.id));
  const tiles: Tile[] = [...dates.map((date) => ({ kind: "date" as const, at: date.startsAt, date })), ...skipped.map((round) => ({ kind: "skipped" as const, at: round.startsAt, round }))].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
  const pages = Math.max(1, Math.ceil(tiles.length / PAGE_SIZE));
  const { page: pageParam } = await searchParams;
  const page = Math.min(pages, Math.max(1, Number(typeof pageParam === "string" ? pageParam : 1) || 1));
  const shown = tiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = dates.at(-1);
  const since = first && DateTime.fromJSDate(first.startsAt, { zone: APP_TIMEZONE }).setLocale("de").toFormat("LLLL");
  const people = new Map([user, partner].map((p) => [p.id, p]));

  return (
    <>
      <AutoRefresh />
      <AppHeader action={<HeaderMeta>{dates.length === 1 ? "1 Date" : `${dates.length} Dates`}{since ? ` · seit ${since}` : ""}</HeaderMeta>} />
      <h1 className="headline text-[54px]">unser beet.</h1>
      {/* What is coming up lives on the Beet; here: what you had. */}
      {next && (
        <Link href="/plan" className="tap flex items-center gap-2.5 rounded-[18px] bg-surface px-3.5 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            Als Nächstes: <b className="font-semibold">{next.title}</b> · {formatShortDate(next.startsAt)}
          </span>
          <span className="font-semibold underline">ansehen</span>
        </Link>
      )}

      {tiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border-2 border-dashed border-line px-6 py-8 text-center">
          <Mascot id="no-dates" size={64} />
          <p className="text-xl font-bold">Hier wächst euer Beet</p>
          <p className="text-muted">Jedes Date wird hier eine Kachel – mit Foto, wenn ihr eins festhaltet.</p>
        </div>
      ) : (
        <>
          <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-2.5 gap-y-3">
            {shown.map((tile, i) =>
              tile.kind === "date" ? (
                <li key={tile.date.id}>
                  <DateTile date={tile.date} me={user} partner={partner} cover={covers.get(tile.date.id)} planner={people.get(tile.date.organizerId ?? "")} tone={TILES[(i + page) % TILES.length]} />
                </li>
              ) : (
                <li key={tile.round.id}>
                  <WiltedTile round={tile.round} planner={people.get(tile.round.plannerId ?? "")} />
                </li>
              ),
            )}
          </ul>
          {pages > 1 && (
            <nav aria-label="Seiten" className="mt-auto flex items-center justify-between text-sm font-semibold">
              {page > 1 ? (
                <Link href={page === 2 ? "/dates" : `/dates?page=${page - 1}`} className="underline">
                  ← Neuere
                </Link>
              ) : (
                <span />
              )}
              <span className="font-mono text-[11px] font-normal text-muted">
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
    </>
  );
}

/** "Sa 18.10." */
function shortDay(d: Date) {
  const t = DateTime.fromJSDate(d, { zone: APP_TIMEZONE }).setLocale("de");
  return `${t.toFormat("ccc").replace(".", "")} ${t.toFormat("dd.LL.")}`;
}

/** Whose round it was: a dot in their color with the initial. */
function PlannerDot({ person }: { person?: User }) {
  if (!person) return null;
  return (
    <span
      aria-label={`geplant von ${person.name}`}
      className="absolute left-2.5 top-2.5 flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: PERSON_HEX[person.color ?? "mandarine"] }}
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

function DateTile({ date, me, partner, cover, planner, tone }: { date: PastDate; me: User; partner: User; cover?: string; planner?: User; tone: string[] }) {
  const { mine, partnerHidden } = visibleReviews(date.reviews, me.id);
  return (
    <Link href={`/dates/${date.id}`} className="tap flex flex-col gap-2">
      <span className="relative flex h-[clamp(120px,20vh,170px)] items-center justify-center overflow-hidden rounded-[20px]" style={{ background: tone[0] }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- private photo route
          <img src={`/api/photos/${cover}?size=thumb`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <span aria-hidden="true" className="absolute -bottom-8 -left-5 h-[90px] w-[120px] rounded-[50%]" style={{ background: tone[1] }} />
            <span aria-hidden="true" className="absolute -right-2.5 top-5 size-[70px] rounded-full" style={{ background: tone[2] }} />
          </>
        )}
        <PlannerDot person={planner} />
        {!mine && <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[11px] text-tinte">Bewerten</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-px px-1">
        <span className="line-clamp-2 text-[15px] font-bold leading-[1.15]">{date.title}</span>
        <span className="font-mono text-[11px] text-muted">
          {shortDay(date.startsAt)}
          {partnerHidden && ` · ${partner.name} hat bewertet 🔒`}
        </span>
      </span>
    </Link>
  );
}

function WiltedTile({ round, planner }: { round: SkippedRound; planner?: User }) {
  const week = DateTime.fromJSDate(round.startsAt, { zone: APP_TIMEZONE }).weekNumber;
  return (
    <div className="flex flex-col gap-2" data-wilted>
      <span className="relative flex h-[clamp(120px,20vh,170px)] items-center justify-center rounded-[20px] border-2 border-dashed border-line px-3 text-center text-[13px] text-muted">
        kein Date – das Blatt ist welk
        <PlannerDot person={planner} />
      </span>
      <span className="flex flex-col gap-px px-1">
        <span className="text-[15px] font-bold leading-[1.15] text-muted">Woche {week} ausgefallen</span>
        <span className="font-mono text-[11px] text-muted">KW {week}</span>
      </span>
    </div>
  );
}
