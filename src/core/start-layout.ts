// The start page has one screen: either the status box gets the room (something is pending)
// or the swipe card does (nothing to do right now). Pure – next to next-step.ts.

import type { NextStep } from "./next-step";

export type DeckSize = "big" | "teaser";

/**
 * - Something stands: a plan to confirm, a confirmation to wait for, a date this round, a
 *   date to rate (even when another step heads the page), a proposal to take, a calendar to connect → the box gets the room and
 *   swiping shrinks to one line ("💞 12 neue Ideen zum Swipen ›").
 * - Nothing stands (my turn but nothing planned yet, the other person is on, the round is
 *   over, a suggestion round without a proposal) → the swipe card is big.
 */
export function deckSize(step: NextStep["kind"] | null, suggestionOpen: boolean, reviewPending = false): DeckSize {
  // A date to rate always has its card on the start, whatever step heads the page.
  if (reviewPending) return "teaser";
  switch (step) {
    case "confirm":
    case "wait_confirm":
    case "date_ahead":
    case "review":
    case "connect_calendar":
    case "partner_calendar":
      return "teaser";
    case "suggestion":
      return suggestionOpen ? "teaser" : "big";
    case "plan":
    case "partner_turn":
    case "round_done":
    case null:
      return "big";
  }
}

/** The one line that stands in for the swipe card: "💞 12 neue Ideen zum Swipen ›". */
export function teaserLabel(count: number): string {
  if (count <= 0) return "Neue Ideen holen";
  return `${count} ${count === 1 ? "neue Idee" : "neue Ideen"} zum Swipen`;
}
