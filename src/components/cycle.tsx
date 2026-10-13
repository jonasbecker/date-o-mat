// Building blocks of the home screen: round card, status stepper, history dots.
import { cn } from "@/lib/cn";
import type { CycleStatus, UserColor } from "@/lib/domain";
import { formatCycleRange, formatDeadline, formatShortDate, timeLeftLabel } from "@/lib/format";
import type { Cycle, User } from "@/server/db/schema";
import { Card, Chip, type CardTone } from "./card";
import { CheckIcon, ClockIcon } from "./icons";

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

const PERSON_TONE: Record<UserColor, CardTone> = { mandarine: "mandarine", himmel: "himmel" };

function heroTitle(cycle: Cycle, me: User, partner: User): string {
  switch (cycle.status) {
    case "planned":
      return "Date geplant!";
    case "confirmed":
      return "Date steht! 🎉";
    case "done":
      return "Runde geschafft 💚";
    case "skipped":
      return "Runde vorbei";
    default:
      if (cycle.mode === "suggestion") return "Zeit für ein Date!";
      return cycle.plannerId === me.id ? "Du bist dran!" : `${partner.name} ist dran`;
  }
}

function heroTone(cycle: Cycle, me: User, partner: User): CardTone {
  if (cycle.status === "planned") return "zitrone";
  if (cycle.status === "confirmed" || cycle.status === "done") return "minze";
  if (cycle.mode === "suggestion") return "lavendel";
  const planner = cycle.plannerId === me.id ? me : partner;
  return PERSON_TONE[planner.color ?? "mandarine"];
}

export function CycleHero({ cycle, me, partner, now }: { cycle: Cycle; me: User; partner: User; now: Date }) {
  const deadlinePassed = cycle.deadlineAt <= now;
  return (
    <Card tone={heroTone(cycle, me, partner)} size="lg" className="animate-pop-in relative flex flex-col gap-3.5 overflow-hidden">
      <svg aria-hidden="true" width="96" height="96" viewBox="0 0 24 24" className="absolute -right-3.5 -top-3.5 rotate-[14deg]">
        <path
          d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"
          fill="#ffd93d"
          stroke="#2a1b3d"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex gap-2">
        <Chip className="bg-bg">Runde {cycle.seq}</Chip>
        <Chip className="bg-bg">{formatCycleRange(cycle.startsAt, cycle.endsAt)}</Chip>
      </div>
      <h1 className="text-[44px] font-bold leading-none">{heroTitle(cycle, me, partner)}</h1>
      {cycle.status === "open" && (
        <p className="flex flex-wrap items-center gap-2 font-bold">
          <ClockIcon width={20} height={20} />
          {deadlinePassed ? (
            <span>Deadline vorbei – bis {formatShortDate(new Date(cycle.endsAt.getTime() - 1))} geht noch was!</span>
          ) : (
            <>
              <span>
                Plan bis <strong className="font-extrabold">{formatDeadline(cycle.deadlineAt)}</strong>
              </span>
              <span className="rounded-full border-2 border-line bg-zitrone px-2 py-px text-xs font-extrabold text-tinte">
                {timeLeftLabel(now, cycle.deadlineAt)}
              </span>
            </>
          )}
        </p>
      )}
      <CycleStepper status={cycle.status === "skipped" ? "open" : cycle.status} />
    </Card>
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
