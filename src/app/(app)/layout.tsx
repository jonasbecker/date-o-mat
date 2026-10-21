import { Suspense } from "react";
import { AppBadgeCount } from "@/components/app-badge-count";
import { BottomNav, BottomNavBar } from "@/components/bottom-nav";
import { CelebrationProvider } from "@/components/celebration";
import { ErrorReporter } from "@/components/error-reporter";
import { Gestures } from "@/components/gestures";
import { NavPending } from "@/components/nav-pending";
import { OfflineNote } from "@/components/offline-note";
import { SwipeQueueFlusher } from "./ideas/entdecken/swipe-queue-flusher";
import { BeetSkeleton, WishlistCount } from "@/components/app-header";

// Shell for all signed-in pages. Static on purpose: everything that reads the
// session sits inside the one <Suspense> boundary around the pages (Cache Components).
// One screen high: pages fit and are clicked through; only lists scroll inside
// (wishlist, events). Should a page not fit on a small phone, it scrolls as a fallback.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CelebrationProvider>
      <div className="mx-auto flex h-dvh max-w-md flex-col">
        {/* pb-7: the big Beet circle of the tab bar reaches 22 px (+ its 6 px ring) up into the page. */}
        <main data-screen className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none px-5 pt-[max(env(safe-area-inset-top),16px)] pb-7">
          {/* The one loading boundary of the signed-in pages: above the pages, so a tab switch keeps the old page
              until the new one is there (the tab lights up at once) – no skeleton flashing in between. */}
          <Suspense fallback={<BeetSkeleton />}>{children}</Suspense>
        </main>
        <Suspense fallback={null}>
          <NavPending />
          <Gestures />
          <OfflineNote />
          <SwipeQueueFlusher />
          <ErrorReporter />
        </Suspense>
        <Suspense fallback={null}>
          <AppBadgeCount />
        </Suspense>
        {/* The path is only known at runtime: the bar is there from the start, the active item follows. */}
        <Suspense fallback={<BottomNavBar path="" />}>
          <BottomNav
            wishlistBadge={
              <Suspense fallback={null}>
                <WishlistCount />
              </Suspense>
            }
          />
        </Suspense>
      </div>
    </CelebrationProvider>
  );
}
