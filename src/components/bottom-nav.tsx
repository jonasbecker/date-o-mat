"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { BulbIcon, HeartIcon } from "./icons";
import { LogoMark } from "./logo";

function Side({ href, label, shown, active, marker, badge, children }: { href: string; label: string; shown: string; active: boolean; marker?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-header-icon={marker}
      className="press relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl"
    >
      <span className={cn("relative flex h-8 w-14 items-center justify-center rounded-full border-2", active ? "border-line bg-himbeere-soft text-tinte" : "border-transparent text-ink")}>
        {children}
        {badge}
      </span>
      <span className={cn("text-[12px] leading-none", active ? "font-extrabold" : "font-bold text-muted")} aria-hidden="true">
        {shown}
      </span>
    </Link>
  );
}

/**
 * The navigation of the app: wishlist on the left, past dates on the right and the logo in the
 * middle – it starts planning a date. Settings sit at the top. `wishlistBadge` is the count on 💡.
 */
export function BottomNav({ wishlistBadge }: { wishlistBadge?: React.ReactNode }) {
  return <BottomNavBar path={usePathname()} wishlistBadge={wishlistBadge} />;
}

/** The bar itself – also what shows while the current path is still unknown (prerender). */
export function BottomNavBar({ path, wishlistBadge }: { path: string; wishlistBadge?: React.ReactNode }) {
  return (
    <nav aria-label="Hauptmenü" className="shrink-0 border-t-2 border-line bg-bg px-5 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
      <div className="mx-auto flex max-w-md items-end justify-between gap-2">
        <Side href="/ideas" label="Ideen" shown="Ideen" active={path.startsWith("/ideas")} marker="wishlist" badge={wishlistBadge}>
          <BulbIcon width={22} height={22} />
        </Side>
        <Link
          href="/plan?pick=1"
          aria-label="Neues Date planen"
          data-nav-plan
          className="sticker press -mt-6 flex size-[72px] shrink-0 items-center justify-center rounded-full bg-zitrone-soft"
        >
          <LogoMark size={54} clipId="nav-logo" />
        </Link>
        <Side href="/dates" label="Eure Dates" shown="Dates" active={path.startsWith("/dates")}>
          <HeartIcon width={22} height={22} />
        </Side>
      </div>
    </nav>
  );
}
