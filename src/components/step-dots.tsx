import { cn } from "@/lib/cn";

/** ● ○ – where you are in the flow, instead of "Schritt 1 von 2". */
export function StepDots({ step, of }: { step: number; of: number }) {
  return (
    <span role="img" aria-label={`Schritt ${step} von ${of}`} className="flex items-center gap-1.5">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={cn("h-2.5 rounded-full border-2 border-line transition-all", i + 1 === step ? "w-6 bg-ink" : "w-2.5 bg-surface")} />
      ))}
    </span>
  );
}
