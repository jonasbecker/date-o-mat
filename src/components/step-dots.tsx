import { cn } from "@/lib/cn";

/**
 * ● ○ ○ ○ – where you are (DESIGN.md §4: 6 px dots, the active one 22 px wide). `all`: everything done
 * (a date is planned) – one lit bar as wide as the dots.
 */
export function StepDots({ step, of, all, className }: { step: number; of: number; all?: boolean; className?: string }) {
  if (all) {
    return <span role="img" aria-label="Date geplant" className={cn("block h-1.5 rounded-[3px] bg-ink", className)} style={{ width: 22 + (of - 1) * 12 }} />;
  }
  return (
    <span role="img" aria-label={`Schritt ${step} von ${of}`} className={cn("flex items-center gap-1.5", className)}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={cn("h-1.5 rounded-[3px] bg-ink transition-[width,opacity] duration-200", i + 1 === step ? "w-[22px]" : "w-1.5 opacity-35")} />
      ))}
    </span>
  );
}
