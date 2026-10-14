import { after, connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { IdeasTabs } from "@/components/ideas-tabs";
import { DECK_REFILL_BELOW } from "@/core/deck";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { deckFor, refillDeck } from "@/server/deck";
import { getCoupleSettings } from "@/server/settings";
import { SwipeDeck } from "./swipe-deck";

// "Neue Ideen holen" waits for Claude (about half a minute).
export const maxDuration = 90;

export default function DiscoverPage() {
  return (
    <div className="flex flex-col gap-4">
      <IdeasTabs current="entdecken" />
      <Suspense fallback={<PageSkeleton />}>
        <Discover />
      </Suspense>
    </div>
  );
}

async function Discover() {
  const ctx = await requireCouple();
  await connection();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const deck = await deckFor(ctx, now);
  // Running low: the next batch is made in the background, AutoRefresh brings it in.
  if (deck.ai && !deck.generating && deck.cards.length < DECK_REFILL_BELOW) {
    after(() => refillDeck(ctx.coupleId, now));
  }
  return (
    <>
      <AutoRefresh intervalMs={deck.generating || deck.cards.length < DECK_REFILL_BELOW ? 6_000 : 30_000} />
      <SwipeDeck {...deck} partnerName={ctx.partner.name} />
    </>
  );
}
