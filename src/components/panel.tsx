/**
 * The page behind a header icon (wishlist, history, settings): it drops down
 * from the top under the header; the same icon folds it up again.
 */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-panel className={`animate-drop-in flex min-h-0 pt-1 flex-1 flex-col gap-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}
