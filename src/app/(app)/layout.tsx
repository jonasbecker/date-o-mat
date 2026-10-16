import { CelebrationProvider } from "@/components/celebration";

// Shell for all signed-in pages. Static on purpose: everything that reads the
// session sits inside a <Suspense> boundary in the pages (Cache Components).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CelebrationProvider>
      <main className="mx-auto max-w-md px-5 pb-12 pt-5">{children}</main>
    </CelebrationProvider>
  );
}
