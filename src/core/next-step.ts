// "Dein nächster Schritt": the one thing that matters most right now, shown
// big on the home screen. Pure – everything it needs comes in as plain data.

import type { CycleStatus, DateStatus, PlanMode } from "@/lib/domain";

export type CalendarState = "connected" | "missing" | "reauth";

export type StepInput = {
  meId: string;
  myCalendar: CalendarState;
  partnerCalendar: CalendarState;
  cycle: { status: CycleStatus; mode: PlanMode; plannerId: string | null };
  /** The next date that has not happened yet (any round). */
  upcoming: { id: string; status: DateStatus; proposedById: string | null } | null;
  /** A date that happened and that I have not reviewed yet. */
  toReview: { id: string; title: string } | null;
  /** A date that is over but nobody ever said yes to – "Habt ihr's gemacht?". */
  unanswered?: { id: string; title: string } | null;
};

export type NextStep =
  | { kind: "connect_calendar"; reauth: boolean }
  | { kind: "confirm"; dateId: string }
  | { kind: "did_it"; dateId: string; title: string }
  | { kind: "plan" }
  | { kind: "suggestion" }
  | { kind: "partner_calendar" }
  | { kind: "review"; dateId: string; title: string }
  | { kind: "wait_confirm"; dateId: string }
  | { kind: "partner_turn" }
  | { kind: "date_ahead"; dateId: string }
  | { kind: "round_done"; skipped: boolean };

/**
 * Priority: without my calendar nothing works → answer the partner's plan →
 * plan when it is my turn → say how the last date was → otherwise show what
 * we are waiting for.
 */
export function nextStep(input: StepInput): NextStep {
  const { meId, myCalendar, partnerCalendar, cycle, upcoming, toReview } = input;
  if (myCalendar !== "connected") return { kind: "connect_calendar", reauth: myCalendar === "reauth" };
  if (upcoming?.status === "planned" && upcoming.proposedById !== meId) return { kind: "confirm", dateId: upcoming.id };
  // A quick yes/no first – until then the round is neither done nor wilted.
  if (input.unanswered) return { kind: "did_it", dateId: input.unanswered.id, title: input.unanswered.title };

  if (cycle.status === "open") {
    const mine = cycle.mode === "suggestion" || cycle.plannerId === meId;
    if (mine && partnerCalendar !== "connected") return { kind: "partner_calendar" };
    if (mine) return { kind: cycle.mode === "suggestion" ? "suggestion" : "plan" };
  }

  if (toReview) return { kind: "review", dateId: toReview.id, title: toReview.title };
  if (upcoming?.status === "planned") return { kind: "wait_confirm", dateId: upcoming.id };
  if (upcoming?.status === "confirmed") return { kind: "date_ahead", dateId: upcoming.id };
  if (cycle.status === "open") return { kind: "partner_turn" };
  return { kind: "round_done", skipped: cycle.status === "skipped" };
}

/** "Diese Woche", "Diese zwei Wochen", … – friendlier than "Runde 7". */
export function periodLabel(start: Date, end: Date): string {
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days <= 7) return "Diese Woche";
  if (days <= 14) return "Diese zwei Wochen";
  if (days <= 16) return "Diese Monatshälfte";
  return "Dieser Monat";
}
