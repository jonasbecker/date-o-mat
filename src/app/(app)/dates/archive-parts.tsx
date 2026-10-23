// The pieces of the Archiv (ARCHIV.md §1): the stem with its leaves and month marks, the grid in month groups, and a
// leaf's picture – a photo, or without one the idea's banner. Server components (no state): the views switch in
// archive-views.tsx.
import Link from "next/link";
import { Banner } from "@/components/banner";
import { monthGroups, stemLayout, type Leaf } from "@/core/archive";
import { cn } from "@/lib/cn";
import { PERSON_HEX, type UserColor } from "@/lib/domain";

export type ArchivePerson = { id: string; name: string; color: UserColor | null };

/** A round avatar in the person's color: who planned it. */
export function PersonDot({ person, size = 24, label }: { person?: ArchivePerson; size?: number; label?: string }) {
  if (!person) return null;
  return (
    <span
      role="img"
      aria-label={label ?? `${person.name} hat geplant`}
      className={cn("flex shrink-0 items-center justify-center rounded-full font-bold", person.color === "himmel" ? "text-white" : "text-[#111A14]")}
      style={{ width: size, height: size, fontSize: size >= 22 ? 11 : 9, background: PERSON_HEX[person.color ?? "mandarine"] }}
    >
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** The first photo (thumbnail), or the idea's banner – never an empty leaf. */
export function LeafPicture({ leaf, className }: { leaf: Leaf; className?: string }) {
  const photo = leaf.photoIds[0];
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- private photo route
    <img src={`/api/photos/${photo}?size=thumb`} alt="" loading="lazy" className={cn("absolute inset-0 size-full object-cover", className)} />
  ) : (
    <Banner motiv={leaf.motif} className={cn("absolute inset-0", className)} />
  );
}

const CHIP: Record<Leaf["chip"]["tone"], string> = {
  both: "bg-[#F5EFC6] text-[#3A2E10]",
  plain: "bg-[#26332B] text-[#C9D4C4]",
  wilt: "bg-surface text-muted-2",
};

/**
 * The stem (Archiv.html): a green line down the middle, the bud for the next date on top, month marks on the stem and
 * the leaves alternating left and right – a photo in the shape of a leaf, its title on the other side.
 */
export function Stem({ leaves, people, bud }: { leaves: Leaf[]; people: Map<string, ArchivePerson>; bud: string | null }) {
  const { marks, items, height } = stemLayout(leaves);
  const top = bud ? 56 : 8;
  return (
    <div data-scroll data-stem className="-mx-5 min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="relative [--leaf:min(168px,calc(50%-26px))]" style={{ height: top + height + 28 }}>
        <span aria-hidden="true" className="absolute bottom-0 left-1/2 w-[5px] -translate-x-1/2 rounded-[3px] bg-[#3E8E52]" style={{ top: bud ? 20 : 0 }} />
        {bud && (
          <>
            <span aria-hidden="true" data-bud className="absolute left-1/2 top-0 size-9 -translate-x-1/2 rounded-full border-2 border-dashed border-[#6DBA74] bg-bg" />
            <span className="absolute left-[calc(50%+27px)] top-0.5 max-w-[calc(50%-32px)] -rotate-3 truncate font-hand text-xl font-semibold text-butter">{bud}</span>
          </>
        )}
        {marks.map((m) => (
          <span
            key={m.label + m.top}
            data-month={m.label}
            className="absolute left-1/2 flex h-6 w-[110px] -translate-x-1/2 items-center justify-center rounded-full border-[1.5px] border-[#3E8E52] bg-bg font-mono text-[10px] tracking-[0.06em] text-muted"
            style={{ top: top + m.top }}
          >
            {m.label}
          </span>
        ))}
        {items.map(({ leaf, top: y, height: h, side }) => {
          const left = side === "left";
          const wilt = leaf.kind === "wilt";
          const planner = people.get(leaf.plannerId ?? "");
          return (
            <div key={leaf.kind + leaf.id} data-leaf={leaf.kind} data-leaf-nr={leaf.nr}>
              <span aria-hidden="true" className={cn("absolute h-[3px] w-[22px] bg-[#3E8E52]", left ? "left-[calc(50%-23px)]" : "left-[calc(50%+1px)]")} style={{ top: top + y + h / 2 }} />
              <Link
                href={leaf.href}
                aria-label={`Nº${leaf.nr} ${leaf.title}`}
                className={cn(
                  "tap absolute w-[var(--leaf)] overflow-hidden",
                  left ? "left-[calc(50%-13px-var(--leaf))] rotate-6 rounded-[90%_0_90%_0]" : "left-[calc(50%+13px)] -rotate-6 rounded-[0_90%_0_90%]",
                  wilt ? "flex items-center justify-center border-2 border-dashed border-[#5A6E5E]" : "shadow-[0_0_0_4px_#4FA25E]",
                )}
                style={{ top: top + y, height: h }}
              >
                {wilt ? (
                  <span className="text-xs text-muted">welk</span>
                ) : (
                  <>
                    <LeafPicture leaf={leaf} />
                    {leaf.photoIds.length > 1 && (
                      <span className="absolute bottom-3 left-1/2 flex h-5 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-[rgba(17,26,20,0.7)] font-mono text-[10px] text-ink">
                        1/{leaf.photoIds.length}
                      </span>
                    )}
                  </>
                )}
              </Link>
              <div
                className={cn("absolute flex w-[min(160px,calc(50%-31px))] flex-col gap-1", left ? "left-[calc(50%+17px)] items-start text-left" : "right-[calc(50%+17px)] items-end text-right")}
                style={{ top: top + y + h / 2 - 54 }}
              >
                <PersonDot person={planner} label={planner ? `${planner.name} hat geplant` : undefined} />
                <span className={cn("line-clamp-3 text-base font-bold leading-[1.15]", wilt ? "text-muted" : "text-ink")}>{leaf.title}</span>
                <span className="font-mono text-[11px] text-muted">{leaf.day}</span>
                <span className={cn("mt-1 inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold", CHIP[leaf.chip.tone])}>{leaf.chip.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The grid (Archiv.html, raster): two columns per month, a square photo with a leaf's corners. */
export function Grid({ leaves, people }: { leaves: Leaf[]; people: Map<string, ArchivePerson> }) {
  return (
    <div data-scroll data-grid className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-1 pb-2">
      {monthGroups(leaves).map((g) => (
        <section key={g.month} aria-label={g.label} className="flex flex-col gap-2.5">
          <h2 className="flex justify-between px-1 pt-1.5 font-mono text-[11px] tracking-[0.06em]">
            <span className="text-muted">{g.label}</span>
            <span className="text-muted-2">{g.count}</span>
          </h2>
          <ul className="grid grid-cols-2 gap-2.5">
            {g.leaves.map((leaf) => {
              const planner = people.get(leaf.plannerId ?? "");
              const wilt = leaf.kind === "wilt";
              return (
                <li key={leaf.kind + leaf.id} data-leaf={leaf.kind}>
                  <Link href={leaf.href} className="tap flex flex-col gap-2">
                    <span
                      className={cn(
                        "relative flex aspect-square items-center justify-center overflow-hidden rounded-[30px_8px_30px_8px]",
                        wilt && "border-2 border-dashed border-[#3A4A40]",
                      )}
                    >
                      {wilt ? (
                        <span className="flex flex-col items-center gap-2">
                          <span aria-hidden="true" className="h-[26px] w-11 rotate-[30deg] rounded-[0_90%_0_90%] border-2 border-dashed border-[#6DBA74]" />
                          <span className="font-mono text-[10px] text-muted">AUSGEFALLEN</span>
                        </span>
                      ) : (
                        <LeafPicture leaf={leaf} />
                      )}
                      {leaf.both && (
                        <span className="absolute right-2 top-2 flex h-[22px] items-center rounded-full bg-[#F5EFC6] px-2 text-[11px] font-bold text-[#3A2E10]">♥ nochmal</span>
                      )}
                      {leaf.photoIds.length > 1 && (
                        <span className="absolute bottom-2 left-2 flex h-5 items-center rounded-full bg-[rgba(17,26,20,0.7)] px-[7px] font-mono text-[10px] text-ink">
                          1/{leaf.photoIds.length}
                        </span>
                      )}
                    </span>
                    <span className={cn("line-clamp-2 text-sm font-bold leading-[1.15]", wilt ? "text-muted" : "text-ink")}>{leaf.title}</span>
                    <span className="-mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted">
                      <PersonDot person={planner} size={16} />
                      {leaf.day}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
