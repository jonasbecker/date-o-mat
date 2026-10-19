import Link from "next/link";
import { requireCouple } from "@/server/auth/dal";
import { countIdeas } from "@/server/ideas";
import { WishlistBadge } from "./wishlist-badge";
import { HeaderIcon } from "./header-icon";

/** The number of wishlist ideas for the badge on 💡 in the bottom bar (reads the database, so it sits in its own Suspense). */
export async function WishlistCount() {
  const { coupleId } = await requireCouple();
  return <WishlistBadge count={await countIdeas(coupleId)} />;
}

export type HeaderPlace = "plan" | "ideas" | "dates" | "settings";

/**
 * The top of a page: the name on the left, settings on the right (and, where a page has one, its
 * own action such as "+ Idee"). Everything else is in the bottom bar (`BottomNav`).
 */
export function AppHeader({ current = "plan", action }: { current?: HeaderPlace; action?: React.ReactNode }) {
  return (
    <header className="flex min-h-10 items-center gap-2.5">
      <Link href="/plan" aria-label="Date-O-Mat – zum Start" className="min-w-0 flex-1 font-display text-[22px] font-bold leading-none">
        Date-O-Mat
      </Link>
      {action}
      <HeaderIcon href="/settings" label="Einstellungen" icon="sliders" active={current === "settings"} />
    </header>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-label="Lädt …">
      <div className="h-10 w-40 rounded-full bg-track" />
      <div className="h-44 rounded-[28px] bg-track" />
      <div className="h-16 rounded-[22px] bg-track" />
    </div>
  );
}
