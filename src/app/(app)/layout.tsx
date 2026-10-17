import { CelebrationProvider } from "@/components/celebration";

// Shell for all signed-in pages. Static on purpose: everything that reads the
// session sits inside a <Suspense> boundary in the pages (Cache Components).
// One screen high: pages fit and are clicked through; only lists scroll inside
// (wishlist, events). Should a page not fit on a small phone, it scrolls as a fallback.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CelebrationProvider>
      <main
        data-screen
        className="mx-auto flex h-dvh max-w-md flex-col overflow-y-auto overscroll-none px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-[max(env(safe-area-inset-top),16px)]"
      >
        {children}
      </main>
    </CelebrationProvider>
  );
}
