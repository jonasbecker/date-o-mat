// Building blocks of the home screen: status stepper and history dots.
import { cn } from "@/lib/cn";
import type { CycleStatus } from "@/lib/domain";
import type { Cycle } from "@/server/db/schema";
import { CheckIcon } from "./icons";

const STEPS: Array<{ status: CycleStatus; label: string }> = [
  { status: "open", label: "Offen" },
  { status: "planned", label: "Geplant" },
  { status: "confirmed", label: "Bestätigt" },
  { status: "done", label: "Erlebt" },
];

export function CycleStepper({ status }: { status: CycleStatus }) {
  const current = STEPS.findIndex((step) => step.status === status);
  return (
    <ol aria-label="Stand der Runde" className="relative grid grid-cols-4 rounded-[18px] border-2 border-line bg-bg px-1.5 pb-2.5 pt-3 text-ink">
      <span aria-hidden="true" className="absolute inset-x-[12.5%] top-[22px] h-[3px] bg-track" />
      {STEPS.map((step, index) => {
        const reached = index <= current;
        const isCurrent = index === current;
        return (
          <li key={step.status} aria-current={isCurrent ? "step" : undefined} className="relative flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex size-[22px] items-center justify-center rounded-full border-2",
                reached ? "border-line bg-himbeere text-tinte" : "border-muted/60 bg-surface",
                isCurrent && "shadow-[0_0_0_4px_var(--color-himbeere-soft)]",
              )}
            >
              {reached && !isCurrent && <CheckIcon width={11} height={11} />}
            </span>
            <span className={cn("text-xs", isCurrent ? "font-extrabold" : "font-bold text-muted")}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Dots for the last rounds: ✓ with date, dashed without, the current one highlighted. */
export function CycleHistory({ history, currentId }: { history: Cycle[]; currentId: string }) {
  const finished = history.filter((c) => c.id !== currentId && (c.status === "done" || c.status === "skipped"));
  const withDate = finished.filter((c) => c.status === "done").length;
  if (history.length < 2) return null;
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 id="history-heading" className="text-[17px] font-semibold">
          Eure letzten Runden
        </h2>
        {finished.length > 0 && (
          <span className="text-[13px] font-bold text-muted">
            {withDate} von {finished.length} mit Date
          </span>
        )}
      </div>
      <ol className="flex flex-wrap gap-2">
        {history.map((cycle) => {
          const isCurrent = cycle.id === currentId;
          const label = `Runde ${cycle.seq}: ${
            isCurrent ? "läuft" : cycle.status === "done" ? "mit Date" : cycle.status === "skipped" ? "ausgefallen" : "geplant"
          }`;
          return (
            <li key={cycle.id} title={label} aria-label={label}>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full font-display text-[15px] font-bold",
                  cycle.status === "done" && "border-2 border-line bg-minze text-tinte",
                  cycle.status === "skipped" && "border-2 border-dashed border-muted/60",
                  (cycle.status === "planned" || cycle.status === "confirmed") && "border-2 border-line bg-zitrone text-tinte",
                  cycle.status === "open" && "border-[2.5px] border-line bg-surface",
                  isCurrent && "shadow-[0_0_0_3px_var(--color-himbeere-soft)]",
                )}
              >
                {cycle.status === "done" ? <CheckIcon width={15} height={15} /> : isCurrent && cycle.status === "open" ? "?" : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
