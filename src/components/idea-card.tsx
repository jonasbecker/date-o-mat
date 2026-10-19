import type { IdeaSize, PlaceSetting, UserColor } from "@/lib/domain";
import { displayHost, formatCost } from "@/lib/idea-input";
import { Avatar } from "./avatar";
import { MoreIcon, PinIcon } from "./icons";
import { SizeChip } from "./size-chip";

/** What an idea card shows – the same card on the wishlist and in the planning flow. */
export type IdeaCardView = {
  id: string;
  title: string;
  size: IdeaSize;
  costEur: number | null;
  location: string | null;
  note?: string | null;
  url?: string | null;
  /** Drinnen / draußen – outdoors the free times look at daylight and weather. */
  setting?: PlaceSetting | null;
  /** Both swiped right on it. */
  matched?: boolean;
  /** It is the next date. */
  isNext?: boolean;
  /** Costs more than the month budget has left. */
  overBudget?: boolean;
  creator?: { name: string; color: UserColor | null } | null;
};

/** "kostenlos · 📍 Stadtwald" – the short facts of an idea in one line. */
export function ideaFacts(idea: Pick<IdeaCardView, "costEur" | "location">): string {
  return [formatCost(idea.costEur), idea.location && `📍 ${idea.location}`].filter(Boolean).join(" · ");
}

/** One idea; tapping it does what the list is for (menu on the wishlist, next step when planning). */
export function IdeaCard({ idea, onOpen, onMore }: { idea: IdeaCardView; onOpen: () => void; /** ⋯ – edit or delete (where tapping does something else). */ onMore?: () => void }) {
  const cost = formatCost(idea.costEur);
  return (
    <div className="flat tap relative flex flex-col gap-1.5 rounded-[18px] bg-surface px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        {/* Stretched button: the whole card reacts, the link stays clickable. */}
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-display text-[17px] font-semibold leading-snug after:absolute after:inset-0 after:rounded-[18px] after:content-['']"
        >
          {idea.title}
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          {idea.creator && <Avatar person={idea.creator} size={26} className="mt-0.5" />}
          {onMore && (
            <button
              type="button"
              onClick={onMore}
              aria-label={`${idea.title} bearbeiten`}
              className="relative z-10 -mr-1.5 flex size-8 items-center justify-center rounded-full text-muted"
            >
              <MoreIcon width={20} height={20} />
            </button>
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-extrabold text-muted">
        <SizeChip size={idea.size} />
        {idea.matched && <span>💞 Match</span>}
        {idea.isNext && <span>📅 Nächstes Date</span>}
        {cost && <span>{cost}</span>}
        {idea.location && (
          <span className="flex items-center gap-1">
            <PinIcon width={13} height={13} strokeWidth={2.8} /> {idea.location}
          </span>
        )}
        {idea.overBudget && <span>⚠️ über Budget</span>}
        {idea.url && (
          <a href={idea.url} target="_blank" rel="noopener noreferrer" className="relative z-10 underline decoration-2 underline-offset-2">
            🔗 {displayHost(idea.url)}
          </a>
        )}
      </div>
      {idea.note && <p className="line-clamp-1 text-sm font-semibold text-muted">{idea.note}</p>}
    </div>
  );
}
