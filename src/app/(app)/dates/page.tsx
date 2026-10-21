import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DateTime } from "luxon";
import { AutoRefresh } from "@/components/auto-refresh";
import { Mascot } from "@/components/mascot";
import { AppHeader, HeaderMeta, PageSkeleton } from "@/components/app-header";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { visibleReviews } from "@/core/reviews";
import { AGAIN_LABEL, APP_TIMEZONE, PERSON_HEX } from "@/lib/domain";
import { cn } from "@/lib/cn";
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
/** Leaves per page on the stem. */
const STEM_PAGE_SIZE = 3;

// Without a photo a tile is a pastel field with two soft shapes (as in MArchiv) – fixed light tones.
const TILES = [
  ["#DCE7F5", "#B9CDEB", "#F2A7BB"],
  ["#F7EBC4", "#EBD58F", "#E8A58D"],
  ["#E6E0F2", "#CBBFE6", "#BFDDB9"],
  ["#F6DFD3", "#E8A58D", "#163A22"],
  ["#DCEBD9", "#8FC79A", "#F7EBC4"],
];

/**
 * ThArchiv (DESIGN-GARTEN.md §5.4): "archiv." (was "unser beet." – the Beet is the start) – the stem: every date a photo leaf, every round that
 * fell through a wilted one, the next date a bud on top. "Raster" is the grid of tiles (MArchiv).
 */
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
  const { page: pageParam, ansicht } = await searchParams;
  const grid = ansicht === "raster";
  const size = grid ? PAGE_SIZE : STEM_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(tiles.length / size));
  const page = Math.min(pages, Math.max(1, Number(typeof pageParam === "string" ? pageParam : 1) || 1));
  const shown = tiles.slice((page - 1) * size, page * size);
  const first = dates.at(-1);
  const since = first && DateTime.fromJSDate(first.startsAt, { zone: APP_TIMEZONE }).setLocale("de").toFormat("LLLL");
  const people = new Map([user, partner].map((p) => [p.id, p]));
  const pageHref = (n: number) => {
    const q = new URLSearchParams({ ...(grid ? { ansicht: "raster" } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString();
    return q ? `/dates?${q}` : "/dates";
  };
  const oldest = tiles.at(-1)?.at;

  return (
    <>
      <AutoRefresh />
      <AppHeader action={<HeaderMeta>{dates.length === 1 ? "1 Blatt" : `${dates.length} Blätter`}{since ? ` · seit ${since}` : ""}</HeaderMeta>} />
      <h1 className="headline text-[54px]">archiv.</h1>
      <nav aria-label="Ansicht" className="inline-flex self-start rounded-full bg-surface p-[3px]">
        {[
          { label: "Stiel", href: "/dates", on: !grid },
          { label: "Raster", href: "/dates?ansicht=raster", on: grid },
        ].map((v) => (
          <Link key={v.label} href={v.href} aria-current={v.on ? "page" : undefined} className={v.on ? "flex h-8 items-center rounded-full bg-cta px-3.5 text-[13px] font-bold text-bg" : "flex h-8 items-center rounded-full px-3.5 text-[13px] font-semibold text-ink"}>
            {v.label}
          </Link>
        ))}
      </nav>
      {/* What is coming up lives on the Beet; here: what you had (the stem shows it as a bud). */}
      {next && grid && (
        <Link href="/plan" className="tap flex items-center gap-2.5 rounded-[18px] bg-surface px-3.5 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            Als Nächstes: <b className="font-semibold">{next.title}</b> · {formatShortDate(next.startsAt)}
          </span>
          <span className="font-semibold underline">ansehen</span>
        </Link>
      )}

      {tiles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border-[1.5px] border-dashed border-line px-6 py-8 text-center">
          <Mascot id="no-dates" size={64} />
          <p className="text-xl font-bold">Hier wächst euer Beet</p>
          <p className="text-muted">Jedes Date wird hier eine Kachel – mit Foto, wenn ihr eins festhaltet.</p>
        </div>
      ) : (
        <>
          {!grid ? (
            <Stem
              shown={shown}
              people={people}
              me={user}
              partner={partner}
              covers={covers}
              bud={page === 1 ? { no: dates.length + 1, next: Boolean(next) } : null}
              start={page === pages && oldest ? DateTime.fromJSDate(oldest, { zone: APP_TIMEZONE }).setLocale("de").toFormat("LLLL yyyy") : null}
            />
          ) : (
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
          )}
          {pages > 1 && (
            <nav aria-label="Seiten" className="mt-auto flex items-center justify-between text-sm font-semibold">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="underline">
                  ← Neuere
                </Link>
              ) : (
                <span />
              )}
              <span className="font-mono text-[11px] font-normal text-muted">
                Seite {page} von {pages}
              </span>
              {page < pages ? (
                <Link href={pageHref(page + 1)} className="underline">
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
      <span className="relative flex h-[clamp(120px,20vh,170px)] items-center justify-center rounded-[20px] border-[1.5px] border-dashed border-line px-3 text-center text-[13px] text-muted">
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

/** A small round avatar in the person's color: who planned it (or whose round it was). */
function PersonDot({ person, label }: { person?: User; label: string }) {
  if (!person) return null;
  return (
    <span
      aria-label={label}
      role="img"
      className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold", person.color === "himmel" ? "text-white" : "text-[#111A14]")}
      style={{ background: PERSON_HEX[person.color ?? "mandarine"] }}
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * The stem (ThArchiv.html): a green line down the middle, the newest leaf on top. A date is its photo
 * in the shape of a leaf on one side, its title on the other; a missed round is a dashed wilted leaf.
 */
function Stem({
  shown,
  people,
  me,
  partner,
  covers,
  bud,
  start,
}: {
  shown: Tile[];
  people: Map<string, User>;
  me: User;
  partner: User;
  covers: Map<string, string>;
  bud: { no: number; next: boolean } | null;
  start: string | null;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" data-stem>
      <span aria-hidden="true" className="absolute bottom-8 left-1/2 top-4 w-[5px] -translate-x-1/2 rounded-[3px] bg-[#3E8E52]" />
      {bud && (
        <div className="relative flex h-10 shrink-0 items-center justify-center">
          <span aria-hidden="true" className="relative size-9 rounded-full border-2 border-dashed border-[#6DBA74] bg-bg" />
          <span className="absolute left-[calc(50%+30px)] top-1 -rotate-3 font-hand text-[21px] font-semibold text-butter">
            Nº{bud.no} – {bud.next ? "kommt bald!" : "kommt noch!"}
          </span>
        </div>
      )}
      <ul className="flex min-h-0 flex-1 flex-col gap-2 pt-2">
        {shown.map((tile, i) => {
          const left = i % 2 === 1;
          return (
            <li key={tile.kind === "date" ? tile.date.id : tile.round.id} className="relative grid h-[clamp(112px,17vh,150px)] grid-cols-2 items-center gap-6">
              {/* the leaf stalk to the stem */}
              <span aria-hidden="true" className={cn("absolute top-1/2 h-[3px] w-[22px] bg-[#3E8E52]", left ? "right-1/2" : "left-1/2")} />
              {tile.kind === "date" ? (
                <>
                  <Link
                    href={`/dates/${tile.date.id}`}
                    aria-label={`${tile.date.title} ansehen`}
                    className={cn(
                      "tap relative flex h-[88%] w-[88%] items-center justify-center overflow-hidden bg-[#2C3A31] shadow-[0_0_0_4px_#4FA25E]",
                      left ? "order-1 rotate-6 justify-self-end rounded-[90%_0_90%_0]" : "order-2 -rotate-6 rounded-[0_90%_0_90%]",
                    )}
                  >
                    {covers.get(tile.date.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- private photo route
                      <img src={`/api/photos/${covers.get(tile.date.id)}?size=thumb`} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <>
                        <span aria-hidden="true" className="absolute -left-2.5 top-[38%] h-20 w-[110px] rounded-[50%] bg-[#3E5446]" />
                        <span aria-hidden="true" className="absolute right-2.5 top-3 size-[60px] rounded-full bg-[#E58FA6] opacity-60" />
                      </>
                    )}
                  </Link>
                  <LeafInfo date={tile.date} me={me} partner={partner} people={people} className={left ? "order-2" : "order-1 items-end text-right"} />
                </>
              ) : (
                <>
                  <div
                    data-wilted
                    className={cn("flex h-[72%] w-[88%] items-center justify-center border-2 border-dashed border-[#5A6E5E]", left ? "order-1 rotate-[8deg] justify-self-end rounded-[90%_0_90%_0]" : "order-2 -rotate-[8deg] rounded-[0_90%_0_90%]")}
                  >
                    <span className={cn("text-xs text-muted", left ? "-rotate-[8deg]" : "rotate-[8deg]")}>welk</span>
                  </div>
                  <div className={cn("flex flex-col gap-[3px]", left ? "order-2" : "order-1 items-end text-right")}>
                    <PersonDot person={people.get(tile.round.plannerId ?? "")} label={`${people.get(tile.round.plannerId ?? "")?.name ?? ""} war dran`} />
                    <span className="text-base font-bold text-muted">Woche {DateTime.fromJSDate(tile.round.startsAt, { zone: APP_TIMEZONE }).weekNumber}</span>
                    <span className="font-mono text-[11px] text-muted-2">ausgefallen</span>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {start && (
        <div className="relative mt-auto flex shrink-0 flex-col items-center pt-3">
          <span aria-hidden="true" className="relative z-10 -mb-1.5 h-4 w-[22px] rounded-[50%] bg-seed" />
          <span aria-hidden="true" className="h-2.5 w-[150px] rounded-[5px] bg-soil" />
          <span className="mt-1 font-hand text-[19px] font-semibold text-muted">hier fing’s an · {start}</span>
        </div>
      )}
    </div>
  );
}

function LeafInfo({ date, me, partner, people, className }: { date: PastDate; me: User; partner: User; people: Map<string, User>; className?: string }) {
  const { mine, partner: theirs, partnerHidden } = visibleReviews(date.reviews, me.id);
  const answers = [mine?.again, theirs?.again];
  const again = answers.includes("yes") ? "yes" : answers.includes("maybe") ? "maybe" : null;
  const planner = people.get(date.organizerId ?? "");
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <PersonDot person={planner} label={`${planner?.name ?? ""} hat geplant`} />
      <span className="line-clamp-2 text-[17px] font-bold leading-[1.15]">{date.title}</span>
      <span className="font-mono text-[11px] text-muted">
        {shortDay(date.startsAt)}
        {partnerHidden && ` · ${partner.name} hat bewertet 🔒`}
      </span>
      {again && <span className="mt-1 inline-flex h-6 items-center rounded-full bg-butter px-2.5 text-[11px] font-semibold text-[#3A2E10]">nochmal: {AGAIN_LABEL[again]}</span>}
      {!mine && <span className="font-mono text-[11px] text-butter">noch bewerten</span>}
    </div>
  );
}
