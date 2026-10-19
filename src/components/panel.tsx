/** The body of a page under the header: takes the height that is left, its lists scroll. */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div data-panel className={`flex min-h-0 flex-1 flex-col gap-4 pt-1 ${className ?? ""}`}>{children}</div>;
}
