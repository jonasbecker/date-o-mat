import { Suspense } from "react";
import { BottomNav, BottomNavBar } from "@/components/bottom-nav";
import { CelebrationProvider } from "@/components/celebration";
import { WishlistCount } from "@/components/app-header";

// Shell for all signed-in pages. Static on purpose: everything that reads the
// session sits inside a <Suspense> boundary in the pages (Cache Components).
// One screen high: pages fit and are clicked through; only lists scroll inside
// (wishlist, events). Should a page not fit on a small phone, it scrolls as a fallback.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CelebrationProvider>
      <div className="mx-auto flex h-dvh max-w-md flex-col">
        {/* pb-7: the big Beet circle of the tab bar reaches 22 px (+ its 6 px ring) up into the page. */}
        <main data-screen className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none px-5 pt-[max(env(safe-area-inset-top),16px)] pb-7">
          {children}
        </main>
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
