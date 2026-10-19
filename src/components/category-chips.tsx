"use client";

import { CATEGORY_LABEL, type IdeaCategory } from "@/core/categories";
import { cn } from "@/lib/cn";
import { useIdeaFilter } from "./idea-filter";

export type ListView = "all" | "match" | "swiped";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("h-9 shrink-0 whitespace-nowrap rounded-full border-2 border-line px-3.5 text-sm font-extrabold", active ? "bg-ink text-bg" : "bg-surface text-ink")}
    >
      {children}
    </button>
  );
}

/**
 * One row above the wishlist: everything, the matches, what has been swiped – and the kinds of
 * dates that occur. The kinds are the shared filter's category (so they hold in the planning
 * list too); matches and swiped are just views of this list.
 */
export function CategoryChips({
  counts,
  view,
  onView,
  matches,
  swiped,
}: {
  counts: Array<{ category: IdeaCategory; count: number }>;
  view: ListView;
  onView: (view: ListView) => void;
  matches: number;
  swiped: number;
}) {
  const [filter, setFilter] = useIdeaFilter();
  const plain = view === "all" && !filter.category;
  return (
    <div role="group" aria-label="Ideen ansehen nach" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      <Chip
        active={plain}
        onClick={() => {
          onView("all");
          setFilter({ ...filter, category: undefined });
        }}
      >
        Alle
      </Chip>
      {matches > 0 && (
        <Chip active={view === "match"} onClick={() => onView(view === "match" ? "all" : "match")}>
          💞 Matches {matches}
        </Chip>
      )}
      {swiped > 0 && (
        <Chip active={view === "swiped"} onClick={() => onView(view === "swiped" ? "all" : "swiped")}>
          💚 Geswipt {swiped}
        </Chip>
      )}
      {counts.map(({ category, count }) => (
        <Chip key={category} active={filter.category === category} onClick={() => setFilter({ ...filter, category: filter.category === category ? undefined : category })}>
          {CATEGORY_LABEL[category].emoji} {CATEGORY_LABEL[category].label} {count}
        </Chip>
      ))}
    </div>
  );
}
