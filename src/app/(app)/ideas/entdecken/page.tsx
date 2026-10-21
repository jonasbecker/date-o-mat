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
import { DeckChrome, DeckInfoButton, DeckUndoButton } from "./deck-chrome";
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
    <DeckChrome>
      {/* Fast only while a batch is being made; a low deck that cannot be refilled (limit, no AI) must not
          ask Google every few seconds. */}
      <AutoRefresh intervalMs={deck.generating ? 6_000 : deck.cards.length < DECK_REFILL_BELOW ? 15_000 : 30_000} />
      <AppHeader
        action={
          // Matches are seedlings (DESIGN-GARTEN.md §5.2) – the pill leads to them; ⓘ explains the page.
          <span className="flex items-center gap-2">
          <Link href="/ideas?ansicht=match" className="tap hit inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6DBA74" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 21v-9M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z" />
            </svg>
            {deck.matches} {deck.matches === 1 ? "Matchling" : "Matchlinge"}
          </Link>
          <DeckInfoButton partnerName={ctx.partner.name} taste={taste} />
          </span>
        }
      />
      {/* SwipeC.html: "swipen." with a mono line under it, the round filter on the right. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[40px] font-extrabold leading-[0.92] tracking-[-0.05em]">swipen.</h1>
          <span className="truncate font-mono text-[11px] text-muted">
            {deck.partnerSwiped > 0 && <>{ctx.partner.name} hat {deck.partnerSwiped} geswipt · </>}
            <Link href="/ideas?ansicht=geswipt" className="underline">
              Meine Likes
            </Link>
          </span>
        </div>
        <span className="flex shrink-0 gap-2">
          <DeckUndoButton />
          <FilterButton round />
        </span>
      </div>
      <SwipeDeck {...deck} partnerName={ctx.partner.name} people={[ctx.user, ctx.partner]} />
    </DeckChrome>
  );
}
