"use client";

import Link, { useLinkStatus } from "next/link";
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
      className="tap relative flex h-[52px] flex-col items-center justify-center gap-[5px] text-ink"
    >
      <TabMark active={active} badge={badge}>
        {children}
      </TabMark>
    </Link>
  );
}

/** The active tab: full opacity and a dot underneath – already while its page is on its way (a tap answers at once). */
function TabMark({ active, badge, children }: { active: boolean; badge?: React.ReactNode; children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  const lit = active || pending;
  return (
    <>
      <span className={cn("relative transition-opacity duration-100", !lit && "opacity-60")}>
        {children}
        {badge}
      </span>
      <span aria-hidden="true" className={cn("size-1 rounded-full bg-current transition-opacity duration-100", !lit && "opacity-0")} />
    </>
  );
}

/**
 * The navigation: Archiv · Swipen · Beet (the start, big and green in the middle) · Ideen · Setup.
 * The bar sits above everything on the page (the date sheet reaches into it), so the Beet circle is never covered.
 * `wishlistBadge` is the count on Ideen.
 */
export function BottomNav({ wishlistBadge }: { wishlistBadge?: React.ReactNode }) {
  const path = usePathname();
  // A leaf, "wie war's?" and a wilted leaf are full screen (ARCHIV.md §2–4): back by the arrow or the gesture.
  if (/^\/dates\/[^/?]+/.test(path)) return null;
  return <BottomNavBar path={path} wishlistBadge={wishlistBadge} />;
}

/** The bar itself – also what shows while the current path is still unknown (prerender). */
export function BottomNavBar({ path, wishlistBadge }: { path: string; wishlistBadge?: React.ReactNode }) {
  const swiping = path.startsWith(SWIPE_PATH);
  const home = path === "/plan" || path === "/";
  return (
    <nav aria-label="Hauptmenü" className="relative z-30 shrink-0 bg-bg pb-[max(env(safe-area-inset-bottom),6px)]">
      <div className="mx-auto grid h-[66px] max-w-md grid-cols-5 items-center">
        <Tab href="/dates" label="Archiv" active={path.startsWith("/dates") || path.startsWith("/story")}>
          <PhotoIcon />
        </Tab>
        <Tab href={SWIPE_PATH} label="Swipen" active={swiping}>
          <SwipeIcon />
        </Tab>
        <Link
          href="/plan"
          aria-label="Beet"
          aria-current={home ? "page" : undefined}
          className={cn(
            "press relative -mt-[22px] flex size-[60px] items-center justify-center justify-self-center rounded-full bg-green text-white shadow-[0_0_0_6px_var(--bg)]",
            home && "ring-2 ring-ink ring-offset-[3px] ring-offset-green",
          )}
        >
          <SproutIcon width={28} height={28} />
        </Link>
        <Tab href="/ideas" label="Ideen" active={path.startsWith("/ideas") && !swiping} marker="wishlist" badge={wishlistBadge}>
          <GridIcon />
        </Tab>
        <Tab href="/settings" label="Einstellungen" active={path.startsWith("/settings") || path.startsWith("/budget")}>
          <TuneIcon />
        </Tab>
      </div>
    </nav>
  );
}
