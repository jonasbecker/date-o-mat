import { cn } from "@/lib/cn";

/** ● ○ ○ ○ – where you are (DESIGN.md §4: 6 px dots, the active one 22 px wide). */
export function StepDots({ step, of, className }: { step: number; of: number; className?: string }) {
  return (
    <span role="img" aria-label={`Schritt ${step} von ${of}`} className={cn("flex items-center gap-1.5", className)}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={cn("h-1.5 rounded-[3px] bg-ink transition-all", i + 1 === step ? "w-[22px]" : "w-1.5 opacity-35")} />
      ))}
    </span>
  );
}
