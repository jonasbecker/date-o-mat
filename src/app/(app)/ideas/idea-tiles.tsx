"use client";

// ThIdeen (DESIGN-GARTEN.md §5.3), the seed shelf: the matches as "Matchlinge" in little pots, the kinds
// of dates as tiles with a small plant each. A tap opens the list of that kind (a local view of the
// wishlist, like Matches and Geswipt).
import type { CategoryKind } from "@/core/idea-category";
import { cn } from "@/lib/cn";

export type TileCounts = Record<Exclude<CategoryKind, "all" | "swiped" | "match">, number>;

const POTS = 5;

const TILES: Array<{ view: keyof TileCounts; label: string; sub: string; className: string; subClass: string; art: React.ReactNode }> = [
  { view: "small", label: "Kurz", sub: "keimt an einem Abend", className: "bg-tile-green text-[#163A22]", subClass: "text-[#4A5A4C]", art: <Radish /> },
  { view: "large", label: "Lang", sub: "wächst einen halben Tag", className: "bg-tile-butter text-[#3A2E10]", subClass: "text-[#6A5A30]", art: <Tree /> },
  { view: "outdoor", label: "Draußen", sub: "braucht Sonne", className: "bg-tile-sky text-[#16283E]", subClass: "text-[#3E5470]", art: <Sunflower /> },
  { view: "indoor", label: "Drinnen", sub: "Fensterbank-Sorten", className: "bg-tile-lilac text-[#2A1E44]", subClass: "text-[#4E4468]", art: <Cactus /> },
  { view: "local", label: "Mit Ort", sub: "Veedel & Rhein", className: "bg-tile-light text-[#163A22]", subClass: "text-[#4A5A4C]", art: <Sign /> },
  { view: "own", label: "Eigene", sub: "von euch gesät", className: "border-[1.5px] border-dashed border-[#3A4A40] bg-surface text-ink", subClass: "text-muted", art: <WateringCan /> },
];

export function IdeaTiles({ counts, matches, onView }: { counts: TileCounts; matches: Array<{ id: string; title: string }>; onView: (view: CategoryKind) => void }) {
  const sprouted = Math.min(matches.length, POTS);
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5">
      {/* Like the other tiles: the count, the name, one line – the pots are its picture, on the right. */}
      <button
        type="button"
        onClick={() => onView("match")}
        aria-label={`Matchlinge: ${matches.length}`}
        className="tap relative col-span-2 flex min-h-[clamp(92px,13.3vh,112px)] flex-col justify-between gap-2 overflow-hidden rounded-[22px] bg-tile-rose p-3.5 text-left text-[#5A2416]"
      >
        {/* A row of pots: every match grows a seedling, empty ones are pale. */}
        <span aria-hidden="true" className="absolute bottom-4 right-4 flex items-end gap-2.5">
          {Array.from({ length: POTS }, (_, i) => {
            const growing = i < sprouted;
            const opacity = growing || (sprouted === 0 && i === 0) ? 1 : 0.45;
            return (
              <span key={i} className="relative h-[22px] w-[30px]">
                {growing && <Seedling />}
                <span className="absolute bottom-0 left-0 h-4 w-[30px] bg-[#D68456]" style={{ opacity, clipPath: "polygon(0 0, 100% 0, 85% 100%, 15% 100%)" }} />
                <span className="absolute bottom-3.5 left-0.5 h-[5px] w-[26px] rounded-[3px] bg-[#6B4A33]" style={{ opacity }} />
              </span>
            );
          })}
        </span>
        <span className="relative text-[30px] font-extrabold leading-none tracking-[-0.04em]">{matches.length}</span>
        <span className="relative flex flex-col gap-px">
          <span className="text-base font-bold">Matchlinge</span>
          <span className="text-xs leading-tight text-[#7A4A3A]">ihr wollt beide</span>
        </span>
      </button>
      {TILES.map((t) => (
        <button
          key={t.view}
          type="button"
          onClick={() => onView(t.view)}
          aria-label={`${t.label}: ${counts[t.view]}`}
          className={cn("tap relative flex min-h-[clamp(92px,13.3vh,112px)] flex-col justify-between gap-2 overflow-hidden rounded-[22px] p-3.5 text-left", t.className)}
        >
          <span aria-hidden="true" className="absolute right-3.5 top-2.5 h-12 w-11">
            {t.art}
          </span>
          <span className="relative text-[30px] font-extrabold leading-none tracking-[-0.04em]">{counts[t.view]}</span>
          <span className="relative flex flex-col gap-px">
            <span className="text-base font-bold">{t.label}</span>
            <span className={cn("text-xs leading-tight", t.subClass)}>{t.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// The small plants (ThIdeen.html), positioned in a 44 × 48 box at the top right of a tile.
function Seedling() {
  return (
    <span className="absolute -top-[18px] left-[11px] h-6 w-2">
      <span className="absolute bottom-0 left-[3px] h-4 w-[3px] rounded-sm bg-[#4FA25E]" />
      <span className="absolute left-1 top-0.5 h-2 w-3.5 origin-left -rotate-[25deg] rounded-[50%] bg-[#6DBA74]" />
      <span className="absolute -left-2.5 top-1.5 h-2 w-3.5 origin-right rotate-[25deg] rounded-[50%] bg-[#4FA25E]" />
    </span>
  );
}
function Radish() {
  return (
    <span className="absolute right-0.5 top-1 h-10 w-8">
      <span className="absolute left-1 top-3.5 size-6 rounded-full bg-[#E8708A]" />
      <span className="absolute left-2 top-0 h-4 w-2.5 -rotate-[20deg] rounded-[50%] bg-[#4FA25E]" />
      <span className="absolute left-[15px] top-0 h-4 w-2.5 rotate-[20deg] rounded-[50%] bg-[#6DBA74]" />
    </span>
  );
}
function Tree() {
  return (
    <span className="absolute inset-0">
      <span className="absolute left-1 top-0 h-[30px] w-8 rounded-full bg-[#8FB46A]" />
      <span className="absolute left-[17px] top-[26px] h-5 w-1.5 rounded-[3px] bg-[#8A6440]" />
    </span>
  );
}
function Sunflower() {
  return (
    <span className="absolute left-0 top-0.5 size-10">
      <span className="absolute inset-0 rounded-full" style={{ background: "repeating-conic-gradient(#F5C84B 0 20deg, transparent 20deg 40deg)" }} />
      <span className="absolute left-2.5 top-2.5 size-5 rounded-full bg-[#8A5A2B]" />
    </span>
  );
}
function Cactus() {
  return (
    <span className="absolute left-1 top-0 h-12 w-[34px]">
      <span className="absolute left-[11px] top-0 h-[34px] w-3 rounded-md bg-[#5E9E6A]" />
      <span className="absolute left-0 top-2.5 h-3.5 w-2 rounded bg-[#5E9E6A]" />
      <span className="absolute left-[26px] top-1.5 h-3.5 w-2 rounded bg-[#5E9E6A]" />
      <span className="absolute left-[5px] top-8 h-3.5 w-6 bg-[#D68456]" style={{ clipPath: "polygon(0 0, 100% 0, 85% 100%, 15% 100%)" }} />
    </span>
  );
}
function Sign() {
  return (
    <span className="absolute left-1 top-0 h-12 w-[34px]">
      <span className="absolute left-0 top-0 h-[22px] w-[34px] rounded bg-[#B9875A]" />
      <span className="absolute left-[15px] top-5 h-[26px] w-1 bg-[#8A6440]" />
      <span className="absolute left-1.5 top-[7px] h-[3px] w-[22px] rounded-sm bg-[#F5EFC6]" />
    </span>
  );
}
function WateringCan() {
  return (
    <span className="absolute left-0 top-1 h-8 w-11">
      <span className="absolute left-3 top-2 h-[22px] w-7 rounded-md bg-[#E58FA6]" />
      <span className="absolute left-[18px] top-0 h-3 w-4 rounded-t-lg border-[3px] border-b-0 border-[#E58FA6]" />
      <span className="absolute left-0 top-3.5 h-1 w-4 -rotate-[24deg] rounded-sm bg-[#E58FA6]" />
    </span>
  );
}
