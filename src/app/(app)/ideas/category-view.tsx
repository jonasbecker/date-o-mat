"use client";

// The view behind a tile of the seed shelf (docs/design/garten/ideen-kategorie/, IdeenKat.html variante "e"): the
// title, the flower with its quip, chips (they are this view's own filter – the one exception to the shared Filter
// button), the flower's tip and the ideas in two groups. One component for every tile, "alle.", the Matchlinge and
// "meine likes."; core/idea-category.ts holds the words and the order.
import Link from "next/link";
import { Suspense, use, useState } from "react";
import { Bloom } from "@/components/bloom";
import { BackIcon } from "@/components/icons";
import { IllustrationArt } from "@/components/illustrations";
import type { Illustration } from "@/core/card-art";
import {
  CATEGORY_VIEW,
  CHIP_LABEL,
  chipMatches,
  chipsFor,
  groupIdeas,
  ideaCount,
  ideaMeta,
  tipOrder,
  type CategoryChip,
  type CategoryKind,
  type IdeaTime,
  type IdeaTimes,
} from "@/core/idea-category";
import { cn } from "@/lib/cn";
import { PERSON_HEX, type IdeaSize, type PlaceSetting, type UserColor } from "@/lib/domain";

export type CategoryIdea = {
  id: string;
  title: string;
  size: IdeaSize;
  costEur: number | null;
  location: string | null;
  setting?: PlaceSetting | null;
  hex: string;
  illustration: Illustration;
  /** Who liked it in the deck (both: a match). */
  likedBy: string[];
  lastPlannedAt: number | null;
  createdAt: number;
};
type Person = { id: string; name: string; color: UserColor | null };

export function CategoryView({
  kind,
  ideas,
  people,
  partnerId,
  times,
  now,
  planHref,
  detailHref,
}: {
  kind: CategoryKind;
  ideas: CategoryIdea[];
  /** Me first, then the partner. */
  people: Person[];
  partnerId: string;
  /** The free times per idea – streamed in (Google), the head and chips do not wait for them. */
  times: Promise<IdeaTimes>;
  now: number;
  /** Where "Ins Beet pflanzen" goes (the planning flow with idea and time, or the idea when a date is planned). */
  planHref: (id: string, startIso: string | null) => string;
  detailHref: (id: string) => string;
}) {
  const view = CATEGORY_VIEW[kind];
  const [chip, setChip] = useState<CategoryChip>("all");
  const [quip, setQuip] = useState(0);
  const chips = chipsFor(kind, ideas);
  // A chip that no longer finds anything (an idea was deleted) falls back to "alle".
  const active = chips.some((c) => c.chip === chip) ? chip : "all";
  const shown = ideas.filter((i) => chipMatches(i, active));
  // Short titles keep the reference's place for the bubble (left of the flower, at the title); on a narrow screen
  // or with a long title it goes up next to the back button, so it never covers the title.
  const short = view.title.length <= 5;

  return (
    <div data-category-view={kind} className="-mx-1 flex min-h-0 flex-1 flex-col">
      <div className="@container relative h-[144px] shrink-0 px-1">
        <div className="flex items-center gap-2">
          <Link data-back href="/ideas" aria-label="Zurück zum Regal" className="tap flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
            <BackIcon width={18} height={18} />
          </Link>
          {/* With a long title (or on a narrow screen) the bubble sits up here – the words give way. */}
          <span className={cn("meta text-[11px] text-muted", short ? "@max-[349px]:sr-only" : "sr-only")}>ideen / regal</span>
        </div>
        <h1 className={cn("headline absolute left-1 top-[50px] max-w-[calc(100%-82px)] truncate pb-1 tracking-[-0.05em]", view.title.length > 8 ? "text-[42px] leading-[1.1]" : "text-[54px]")}>{view.title}</h1>
        <p className="absolute left-1 top-[110px] max-w-[calc(100%-86px)] truncate text-sm text-muted">
          {view.subtitle} · {ideaCount(ideas.length)}
        </p>
        <button
          type="button"
          onClick={() => setQuip((n) => n + 1)}
          aria-label="Blume antippen: neuer Spruch"
          className="absolute right-0 top-7 h-[109px] w-[78px]"
        >
          <Bloom stimmung="froh" blaetter={3} className="size-full" />
        </button>
        <div data-bubble={short ? "low" : "high"} className={cn("pointer-events-none absolute -top-1 right-[84px] flex w-[calc(100%-140px)] justify-end", short && "@[350px]:top-14 @[350px]:w-[134px]")}>
          <p aria-live="polite" className={cn("max-w-full -rotate-2 rounded-[18px] bg-tile-light px-2.5 pb-[7px] pt-1.5 text-center font-hand text-base font-semibold leading-[1.02] text-[#1B2620]", short && "@[350px]:w-full @[350px]:text-[17px]")}>
            {view.quips[quip % view.quips.length]}
          </p>
        </div>
        {/* Two dots from the flower's mouth to the bubble – low beside it, or up toward it. */}
        <span aria-hidden="true" className={cn("absolute right-[63px] top-[60px] size-1.5 rounded-full bg-tile-light", short && "@[350px]:right-[60px] @[350px]:top-[63px]")} />
        <span aria-hidden="true" className={cn("absolute right-[73px] top-12 size-2.5 rounded-full bg-tile-light", short && "@[350px]:right-[71px] @[350px]:top-[70px]")} />
      </div>

      <div role="group" aria-label="Filter" data-no-pull className="-mx-4 flex h-9 shrink-0 gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
        {chips.map(({ chip: c, count }) => (
          <button
            key={c}
            type="button"
            aria-pressed={active === c}
            onClick={() => setChip(c)}
            className={cn(
              "tap flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] px-3.5 text-sm font-semibold",
              active === c ? "border-cta bg-cta text-[#111A14]" : "border-[#3A4A40] text-ink",
            )}
          >
            {CHIP_LABEL[c]}
            <span className="font-mono text-[11px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

      <Suspense key={active} fallback={<Loading />}>
        <TipAndList ideas={shown} times={times} now={now} people={people} partnerId={partnerId} planHref={planHref} detailHref={detailHref} onReset={active === "all" ? null : () => setChip("all")} />
      </Suspense>
    </div>
  );
}

function TipAndList({
  ideas,
  times,
  now,
  people,
  partnerId,
  planHref,
  detailHref,
  onReset,
}: {
  ideas: CategoryIdea[];
  times: Promise<IdeaTimes>;
  now: number;
  people: Person[];
  partnerId: string;
  planHref: (id: string, startIso: string | null) => string;
  detailHref: (id: string) => string;
  onReset: (() => void) | null;
}) {
  const { slots } = use(times);
  const [turn, setTurn] = useState(0);
  if (ideas.length === 0) return <Empty onReset={onReset} />;
  const timed = ideas.map((idea) => ({ ...idea, slotStart: slots[idea.id] ? Date.parse(slots[idea.id]!.startIso) : null, partnerLiked: idea.likedBy.includes(partnerId) }));
  const order = tipOrder(timed, now);
  const tip = order[turn % order.length];
  const { week, later } = groupIdeas(timed, tip.id, now);
  return (
    <>
      <Tip idea={tip} time={slots[tip.id]} now={now} planHref={planHref} detailHref={detailHref} onNext={order.length > 1 ? () => setTurn((n) => n + 1) : null} />
      <ul data-scroll aria-label="Ideen" className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 pb-2">
        <Group title="✓ passt diese Woche" tone="text-[#6DBA74]" ideas={week} people={people} detailHref={detailHref} />
        <Group title="irgendwann" tone="text-muted" ideas={later} people={people} detailHref={detailHref} />
      </ul>
    </>
  );
}

function Tip({
  idea,
  time,
  now,
  planHref,
  detailHref,
  onNext,
}: {
  idea: CategoryIdea & { slotStart: number | null };
  time: IdeaTime | null | undefined;
  now: number;
  planHref: (id: string, startIso: string | null) => string;
  detailHref: (id: string) => string;
  onNext: (() => void) | null;
}) {
  const week = time && idea.slotStart !== null && idea.slotStart - now <= 7 * 86_400_000 ? time : null;
  return (
    <section data-tip={idea.id} aria-label="Tipp der Blume" className="mx-1 mt-3 flex h-[164px] shrink-0 flex-col gap-2.5 rounded-[24px] bg-tile-light p-3 text-[#1B2620]">
      <div className="flex min-w-0 items-center gap-3">
        <Art idea={idea} size="tip" />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#5A6656]">Tipp der Blume</span>
          <h2 className="truncate text-lg font-extrabold leading-tight">
            <Link href={detailHref(idea.id)}>{idea.title}</Link>
          </h2>
          {week ? (
            <span data-tip-when className="truncate text-[13px] font-bold text-[#2E7D46]">
              {week.label} · ✓ beide frei
            </span>
          ) : (
            <span data-tip-when className="truncate text-[13px] font-bold text-[#5A6656]">
              gerade kein gemeinsamer Abend frei
            </span>
          )}
          <span className="truncate font-mono text-[10px] uppercase text-[#5A6656]">{ideaMeta(idea)}</span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Link href={planHref(idea.id, week?.startIso ?? null)} className="tap flex h-11 items-center justify-center rounded-full bg-[#2E7D46] text-[15px] font-bold text-white">
          Ins Beet pflanzen
        </Link>
        {onNext && (
          <button type="button" onClick={onNext} className="tap h-11 rounded-full border-2 border-[#C9D4C4] px-4 text-[15px] font-bold">
            anderer ↻
          </button>
        )}
      </div>
    </section>
  );
}

function Group({ title, tone, ideas, people, detailHref }: { title: string; tone: string; ideas: CategoryIdea[]; people: Person[]; detailHref: (id: string) => string }) {
  if (ideas.length === 0) return null;
  return (
    <li>
      <h3 className="flex justify-between px-1 pb-0.5 pt-1.5 font-mono text-[11px] uppercase">
        <span className={tone}>{title}</span>
        <span className="text-muted-2">{ideas.length}</span>
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {ideas.map((idea) => (
          <li key={idea.id} className="animate-pop-in">
            <Link href={detailHref(idea.id)} className="tap flex h-[72px] items-center gap-3 rounded-[20px] bg-surface py-2 pl-2 pr-2.5">
              <Art idea={idea} size="row" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-bold">{idea.title}</span>
                <span className="truncate font-mono text-[11px] uppercase text-muted">{ideaMeta(idea)}</span>
              </span>
              {people
                .filter((p) => idea.likedBy.includes(p.id))
                .map((p) => (
                  <span
                    key={p.id}
                    role="img"
                    aria-label={`${p.name} mag das`}
                    className="flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-bold text-white"
                    style={{ background: PERSON_HEX[p.color ?? "himmel"] }}
                  >
                    {p.name.slice(0, 1).toUpperCase()} ♥
                  </span>
                ))}
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-divider text-lg">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Art({ idea, size }: { idea: CategoryIdea; size: "tip" | "row" }) {
  return (
    <span
      aria-hidden="true"
      data-art={idea.illustration}
      className={cn("flex shrink-0 items-center justify-center", size === "tip" ? "size-[60px] rounded-2xl" : "size-14 rounded-[15px]")}
      style={{ background: idea.hex }}
    >
      <IllustrationArt name={idea.illustration} className={size === "tip" ? "size-11" : "size-10"} />
    </span>
  );
}

function Empty({ onReset }: { onReset: (() => void) | null }) {
  return (
    <div data-category-empty className="mt-6 flex flex-col items-center gap-3 text-center">
      <Bloom stimmung="traurig" blaetter={2} className="h-[140px] w-[100px]" />
      <p className="font-hand text-[22px] font-semibold leading-tight">hier wächst grad nix. anderer filter?</p>
      {onReset ? (
        <button type="button" onClick={onReset} className="tap h-11 rounded-full bg-cta px-5 text-[15px] font-bold text-bg">
          Filter zurücksetzen
        </button>
      ) : (
        <Link href="/ideas/entdecken" className="tap flex h-11 items-center rounded-full bg-cta px-5 text-[15px] font-bold text-bg">
          Samen swipen
        </Link>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Sucht freie Abende …" className="flex animate-pulse flex-col gap-2 px-1 pt-3">
      <div className="h-[164px] rounded-[24px] bg-track" />
      <div className="h-[72px] rounded-[20px] bg-track" />
      <div className="h-[72px] rounded-[20px] bg-track" />
    </div>
  );
}
