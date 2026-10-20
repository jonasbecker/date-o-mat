import Link from "next/link";
import { requireCouple } from "@/server/auth/dal";
import { countIdeas } from "@/server/ideas";
import { WishlistBadge } from "./wishlist-badge";

/** The number of wishlist ideas for the badge on 💡 in the bottom bar (reads the database, so it sits in its own Suspense). */
export async function WishlistCount() {
  const { coupleId } = await requireCouple();
  return <WishlistBadge count={await countIdeas(coupleId)} />;
}

export type HeaderPlace = "plan" | "ideas" | "dates" | "settings";

/**
 * The top of a page (DESIGN.md): the small name on the left, on the right what the page has there –
 * a meta line ("36 Ideen"), the two avatars or an action. `center`: the step dots, in the middle of
 * the row – the same spot as in the planning flow (`TopRow`, top-row.tsx). Navigation is in the bottom bar.
 */
export function AppHeader({ action, center }: { current?: HeaderPlace; action?: React.ReactNode; center?: React.ReactNode }) {
  return (
    <header className={center ? "relative flex h-11 items-center gap-2.5" : "flex min-h-9 items-center gap-2.5"}>
      <Link href="/plan" aria-label="Date-O-Mat – zum Start" className="min-w-0 flex-1 font-display text-[15px] font-extrabold leading-none tracking-[-0.02em]">
        date-o-mat
      </Link>
      {center && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{center}</span>}
      {action}
    </header>
  );
}

/** Small meta text in DM Mono on the right of the header ("36 Ideen", "Nº15"). */
export function HeaderMeta({ children }: { children: React.ReactNode }) {
  return <span className="meta text-muted">{children}</span>;
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
