import Link from "next/link";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { FilterButton } from "@/components/idea-filter";
import { DECK_REFILL_BELOW } from "@/core/deck";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { deckFor, refillDeck } from "@/server/deck";
import { getCoupleSettings } from "@/server/settings";
import { deckTaste } from "@/server/story";
import { SwipeDeck } from "./swipe-deck";

// "Neue Ideen holen" waits for Claude (about half a minute).
export const maxDuration = 90;

/** MSwipe: the main feature in the middle of the bar – both swipe on their own, ♥ + ♥ = match. */
export default function DiscoverPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Suspense
        fallback={
          <>
            <AppHeader />
            <PageSkeleton />
          </>
        }
      >
        <Discover />
      </Suspense>
    </div>
  );
}

async function Discover() {
  const ctx = await requireCouple();
  await connection();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const [deck, taste] = await Promise.all([deckFor(ctx, now), deckTaste(ctx)]);
  // Running low: the next batch is made in the background, AutoRefresh brings it in.
  // (Without the AI the hand-picked Köln ideas still come in.)
  if (!deck.generating && deck.cards.length < DECK_REFILL_BELOW) {
    after(() => refillDeck(ctx.coupleId, now));
  }
  return (
    <>
      <AutoRefresh intervalMs={deck.generating || deck.cards.length < DECK_REFILL_BELOW ? 6_000 : 30_000} />
      <AppHeader
        action={
          // Matches are seedlings (DESIGN-GARTEN.md §5.2) – the pill leads to them.
          <Link href="/ideas?ansicht=match" className="tap inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6DBA74" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 21v-9M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z" />
            </svg>
            {deck.matches} {deck.matches === 1 ? "Keimling" : "Keimlinge"}
          </Link>
        }
      />
      <div className="flex items-end justify-between gap-3">
        <h1 className="headline text-[54px]">swipen.</h1>
        <div className="flex min-w-0 flex-col items-end gap-1 pb-1">
          <FilterButton />
          {deck.partnerSwiped > 0 && <span className="whitespace-nowrap text-[13px] text-muted">{ctx.partner.name} hat {deck.partnerSwiped} geswiped</span>}
        </div>
      </div>
      <SwipeDeck {...deck} partnerName={ctx.partner.name} people={[ctx.user, ctx.partner]} />
      {taste.length > 0 && (
        <Link href="/story" className="-mt-1 truncate text-center text-xs text-muted">
          Euer Ding: {taste.join(" · ")}
        </Link>
      )}
    </>
  );
}
