"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { GridIcon, PhotoIcon, SproutIcon, SwipeIcon, TuneIcon } from "./icons";

export const SWIPE_PATH = "/ideas/entdecken";

function Tab({ href, label, active, marker, badge, children }: { href: string; label: string; active: boolean; marker?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-header-icon={marker}
      className={cn("tap relative flex h-[52px] flex-col items-center justify-center gap-[5px] text-ink", !active && "opacity-60")}
    >
      <span className="relative">
        {children}
        {badge}
      </span>
      {/* The active tab: full opacity and a dot underneath. */}
      {active && <span aria-hidden="true" className="size-1 rounded-full bg-current" />}
    </Link>
  );
}

/**
 * The navigation (DESIGN.md §4): Beet · Ideen · Swipen (big, in the middle) · Archiv · Setup.
 * `wishlistBadge` is the count on Ideen.
 */
export function BottomNav({ wishlistBadge }: { wishlistBadge?: React.ReactNode }) {
  return <BottomNavBar path={usePathname()} wishlistBadge={wishlistBadge} />;
}

/** The bar itself – also what shows while the current path is still unknown (prerender). */
export function BottomNavBar({ path, wishlistBadge }: { path: string; wishlistBadge?: React.ReactNode }) {
  const swiping = path.startsWith(SWIPE_PATH);
  return (
    <nav aria-label="Hauptmenü" className="shrink-0 bg-bg pb-[max(env(safe-area-inset-bottom),6px)]">
      <div className="mx-auto grid h-[66px] max-w-md grid-cols-5 items-center">
        <Tab href="/plan" label="Beet" active={path === "/plan" || path === "/"}>
          <SproutIcon />
        </Tab>
        <Tab href="/ideas" label="Ideen" active={path.startsWith("/ideas") && !swiping} marker="wishlist" badge={wishlistBadge}>
          <GridIcon />
        </Tab>
        <Link
          href={SWIPE_PATH}
          aria-label="Swipen"
          aria-current={swiping ? "page" : undefined}
          className={cn(
            "press -mt-[22px] flex size-[60px] items-center justify-center justify-self-center rounded-full text-white shadow-[0_0_0_6px_var(--bg)]",
            swiping ? "bg-like" : "bg-green",
          )}
        >
          <SwipeIcon width={26} height={26} />
        </Link>
        <Tab href="/dates" label="Archiv" active={path.startsWith("/dates") || path.startsWith("/story")}>
          <PhotoIcon />
        </Tab>
        <Tab href="/settings" label="Einstellungen" active={path.startsWith("/settings") || path.startsWith("/budget")}>
          <TuneIcon />
        </Tab>
      </div>
    </nav>
  );
}
