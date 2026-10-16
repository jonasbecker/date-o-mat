import Link from "next/link";
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
import { deckTaste } from "@/server/story";
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
  const [deck, taste] = await Promise.all([deckFor(ctx, now), deckTaste(ctx)]);
  // Running low: the next batch is made in the background, AutoRefresh brings it in.
  // (Without the AI the hand-picked Köln ideas still come in.)
  if (!deck.generating && deck.cards.length < DECK_REFILL_BELOW) {
    after(() => refillDeck(ctx.coupleId, now));
  }
  return (
    <>
      <AutoRefresh intervalMs={deck.generating || deck.cards.length < DECK_REFILL_BELOW ? 6_000 : 30_000} />
      <SwipeDeck {...deck} partnerName={ctx.partner.name} />
      {taste.length > 0 && (
        <p className="text-center text-sm font-bold text-muted">
          Euer Ding: {taste.join(" · ")} ·{" "}
          <Link href="/story" className="underline">
            mehr in eurer Date-Story
          </Link>
        </p>
      )}
    </>
  );
}
