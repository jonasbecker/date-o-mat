import Link from "next/link";
import type { BudgetLevel, MonthSpending } from "@/core/budget";
import { cn } from "@/lib/cn";

export type BudgetBarProps = {
  label: string;
  budget: number;
  spending: MonthSpending;
  left: number;
  pot: number;
  level: BudgetLevel;
};

const FILL: Record<BudgetLevel, string> = { ok: "bg-minze", tight: "bg-zitrone", over: "bg-himbeere" };

/** "Oktober: 45 von 80 € · noch 35 €" with a bar (spent solid, planned lighter) and the pot. */
export function BudgetBar({ label, budget, spending, left, pot, level, href = "/budget", compact = false }: BudgetBarProps & { href?: string | null; compact?: boolean }) {
  const used = spending.spent + spending.planned;
  const spentPct = Math.min(100, (spending.spent / budget) * 100);
  const plannedPct = Math.min(100 - spentPct, (spending.planned / budget) * 100);
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-base font-semibold">
          {label}: {used} von {budget} €
        </span>
        <span className="text-sm font-extrabold">{left >= 0 ? `noch ${left} €` : `${-left} € drüber`}</span>
      </div>
      <div
        role="meter"
        aria-label={`Budget ${label}`}
        aria-valuemin={0}
        aria-valuemax={budget}
        aria-valuenow={Math.min(used, budget)}
        aria-valuetext={`${used} von ${budget} € verplant oder ausgegeben`}
        className="flex h-3 overflow-hidden rounded-full bg-surface"
      >
        <span className={cn("h-full", FILL[level])} style={{ width: `${spentPct}%` }} />
        <span className={cn("h-full opacity-50", FILL[level])} style={{ width: `${plannedPct}%` }} />
      </div>
      {!compact && (
        <p className="text-xs font-bold text-muted">
          {spending.planned > 0 ? `davon ${spending.planned} € schon verplant · ` : ""}🎁 Spartopf: {pot} €
        </p>
      )}
    </>
  );
  const className = "flat flex flex-col gap-1.5 rounded-[20px] bg-surface px-4 py-3 text-ink";
  return href ? (
    <Link href={href} className={cn("press", className)}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
