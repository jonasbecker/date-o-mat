import { describe, expect, it } from "vitest";
import type { NextStep } from "./next-step";
import { deckSize, teaserLabel } from "./start-layout";

const KINDS: Array<NextStep["kind"]> = ["connect_calendar", "confirm", "plan", "suggestion", "partner_calendar", "review", "wait_confirm", "partner_turn", "date_ahead", "round_done"];

describe("deckSize", () => {
  it("gives the box the room whenever something is pending", () => {
    for (const kind of ["confirm", "wait_confirm", "date_ahead", "review", "connect_calendar", "partner_calendar"] as const) {
      expect(deckSize(kind, false), kind).toBe("teaser");
    }
  });

  it("a suggestion round: a proposal is pending, no proposal is not", () => {
    expect(deckSize("suggestion", true)).toBe("teaser");
    expect(deckSize("suggestion", false)).toBe("big");
  });

  it("swiping is big when nothing stands: my turn, the other's turn, round over", () => {
    expect(deckSize("plan", false)).toBe("big");
    expect(deckSize("partner_turn", false)).toBe("big");
    expect(deckSize("round_done", false)).toBe("big");
    expect(deckSize(null, false)).toBe("big");
  });

  it("a date to rate shrinks swiping, whatever step heads the page", () => {
    expect(deckSize("plan", false, true)).toBe("teaser");
    expect(deckSize("partner_turn", false, true)).toBe("teaser");
    expect(deckSize("round_done", false, true)).toBe("teaser");
  });

  it("an open proposal does not shrink a state that has no proposal", () => {
    expect(deckSize("plan", true)).toBe("big");
  });

  it("decides every kind of step", () => {
    for (const kind of KINDS) expect(["big", "teaser"]).toContain(deckSize(kind, false));
  });
});

describe("teaserLabel", () => {
  it("counts the cards", () => {
    expect(teaserLabel(12)).toBe("12 neue Ideen zum Swipen");
    expect(teaserLabel(1)).toBe("1 neue Idee zum Swipen");
  });

  it("offers fetching new ideas when the deck is empty", () => {
    expect(teaserLabel(0)).toBe("Neue Ideen holen");
  });
});
