"use client";

// MIdeen: the matches as one big rosé tile, the kinds of dates as pastel tiles below.
// A tap opens the list of that kind (a local view of the wishlist, like Matches and Geswipt).
import type { ListView } from "@/components/category-chips";
import { cn } from "@/lib/cn";

export type TileCounts = Record<Exclude<ListView, "all" | "swiped" | "match">, number>;

const TILES: Array<{ view: keyof TileCounts; label: string; sub: string; bg: string; shape: string; radius: string }> = [
  { view: "small", label: "Kurz", sub: "ein Abend, ~2 Stunden", bg: "bg-tile-green", shape: "#BFDDB9", radius: "50%" },
  { view: "large", label: "Lang", sub: "halber Tag & mehr", bg: "bg-tile-butter", shape: "#EBD58F", radius: "16px" },
  { view: "outdoor", label: "Draußen", sub: "wenn’s Wetter passt", bg: "bg-tile-sky", shape: "#B9CDEB", radius: "50% 50% 0 50%" },
  { view: "indoor", label: "Drinnen", sub: "für Regentage", bg: "bg-tile-lilac", shape: "#CBBFE6", radius: "50%" },
  { view: "local", label: "Mit Ort", sub: "Veedel & Rhein", bg: "bg-white", shape: "#EDF3EA", radius: "16px" },
  { view: "own", label: "Eigene", sub: "von euch eingetragen", bg: "bg-white", shape: "#F6DFD3", radius: "50% 0 50% 50%" },
];

export function IdeaTiles({ counts, matches, onView }: { counts: TileCounts; matches: Array<{ id: string; title: string }>; onView: (view: ListView) => void }) {
  return (
    <div className="grid min-h-0 grid-cols-2 gap-2.5">
      <button
        type="button"
        onClick={() => onView("match")}
        aria-label={`Eure Matches: ${matches.length}`}
        className="tap relative col-span-2 flex h-[clamp(112px,18vh,150px)] flex-col justify-between overflow-hidden rounded-[24px] bg-rose p-4 text-left text-partner-ink"
      >
        <span className="flex items-start justify-between">
          <span className="flex flex-col gap-0.5">
            <span className="text-xl font-extrabold tracking-[-0.02em]">Eure Matches</span>
            <span className="text-[13px]">vom Swipen · ihr wollt beide</span>
          </span>
          <span className="text-[44px] font-extrabold leading-none tracking-[-0.04em]">{matches.length}</span>
        </span>
        <span className="flex gap-1.5 overflow-hidden">
          {matches.slice(0, 2).map((m) => (
            <span key={m.id} className="inline-flex h-[30px] max-w-[46%] shrink-0 items-center truncate rounded-full bg-white px-3 text-[13px] font-semibold">
              <span className="truncate">{m.title}</span>
            </span>
          ))}
          {matches.length > 2 && <span className="inline-flex h-[30px] shrink-0 items-center rounded-full bg-white px-3 text-[13px] font-semibold">+{matches.length - 2}</span>}
          {matches.length === 0 && <span className="text-[13px]">Noch keins – swipt los!</span>}
        </span>
      </button>
      {TILES.map((t) => (
        <button
          key={t.view}
          type="button"
          onClick={() => onView(t.view)}
          aria-label={`${t.label}: ${counts[t.view]}`}
          className={cn("tap relative flex h-[clamp(92px,13.3vh,112px)] flex-col justify-between overflow-hidden rounded-[22px] p-3.5 text-left text-tinte", t.bg)}
        >
          <span aria-hidden="true" className="absolute -right-3 -top-3 size-[58px]" style={{ background: t.shape, borderRadius: t.radius }} />
          <span className="relative text-[30px] font-extrabold leading-none tracking-[-0.04em]">{counts[t.view]}</span>
          <span className="relative flex flex-col gap-px">
            <span className="text-base font-bold">{t.label}</span>
            <span className="text-xs text-[#56604F]">{t.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
