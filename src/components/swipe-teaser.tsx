import Link from "next/link";
import { teaserLabel } from "@/core/start-layout";
import { HeartIcon } from "./icons";

/** Swiping when the status box has the room: one line that opens the whole deck. */
export function SwipeTeaser({ count }: { count: number }) {
  return (
    <Link href="/ideas/entdecken" data-swipe-teaser className="flat tap flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-2.5">
      <HeartIcon width={20} height={20} className="shrink-0 text-himbeere" />
      <span className="min-w-0 flex-1 font-display text-base font-semibold">{teaserLabel(count)}</span>
      <span aria-hidden="true" className="text-lg font-bold">
        ›
      </span>
    </Link>
  );
}
