import Link from "next/link";
import type { IdeaSize } from "@/lib/domain";
import { buttonClass } from "./button";
import { HeartIcon } from "./icons";
import { SizeChip } from "./size-chip";

export type SwipeTeaserData = { count: number; top: { title: string; emoji: string | null; size: IdeaSize } | null };

/**
 * "Solange swipen?" – when there is nothing to plan right now (the other one's turn,
 * the date stands), collecting ideas is the useful thing to do. Big: a small card stack.
 */
export function SwipeTeaser({ deck, big = false }: { deck: SwipeTeaserData; big?: boolean }) {
  const waiting = deck.count === 0 ? "Neue Ideen holen" : `${deck.count} ${deck.count === 1 ? "Karte wartet" : "Karten warten"}`;
  if (!big || !deck.top) {
    return (
      <Link href="/ideas/entdecken" className="flat tap flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-2.5">
        <HeartIcon width={20} height={20} className="shrink-0 text-himbeere" />
        <span className="min-w-0 flex-1 text-sm font-bold">
          <span className="block font-display text-base font-semibold">Solange swipen?</span>
          <span className="block truncate text-muted">{waiting}</span>
        </span>
        <span aria-hidden="true" className="text-lg font-bold">
          →
        </span>
      </Link>
    );
  }
  return (
    <Link href="/ideas/entdecken" aria-label={`Solange swipen? ${waiting}`} className="flat tap flex flex-col gap-3 rounded-[22px] bg-surface p-4">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-semibold">Solange swipen?</span>
        <span className="text-sm font-bold text-muted">{waiting}</span>
      </span>
      {/* A small stack: the card on top, two behind it. */}
      <span className="relative mx-auto block h-[150px] w-[78%]">
        <span aria-hidden="true" className="absolute inset-0 rotate-[5deg] rounded-[18px] border-2 border-line bg-lavendel/40" />
        <span aria-hidden="true" className="absolute inset-0 -rotate-[4deg] rounded-[18px] border-2 border-line bg-himmel/40" />
        <span className="absolute inset-0 flex flex-col justify-between rounded-[18px] border-2 border-line bg-himbeere-soft p-3 text-tinte">
          <span className="text-3xl" aria-hidden="true">
            {deck.top.emoji ?? "💡"}
          </span>
          <span className="flex flex-col gap-1">
            <span className="line-clamp-2 font-display text-[17px] font-semibold leading-snug">{deck.top.title}</span>
            <SizeChip size={deck.top.size} className="self-start" />
          </span>
        </span>
      </span>
      <span className={buttonClass("primary", "md", "w-full")}>
        <HeartIcon width={20} height={20} /> Swipen
      </span>
    </Link>
  );
}
