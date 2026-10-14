import { describe, expect, it } from "vitest";
import { nextStep, periodLabel, type StepInput } from "./next-step";

const base: StepInput = {
  meId: "jonas",
  myCalendar: "connected",
  partnerCalendar: "connected",
  cycle: { status: "open", mode: "alternating", plannerId: "jonas" },
  upcoming: null,
  toReview: null,
};
const step = (patch: Partial<StepInput>) => nextStep({ ...base, ...patch }).kind;

describe("nextStep", () => {
  it("my calendar first", () => {
    expect(nextStep({ ...base, myCalendar: "reauth" })).toEqual({ kind: "connect_calendar", reauth: true });
  });
  it("answer the partner's plan before anything else", () => {
    expect(step({ upcoming: { id: "d", status: "planned", proposedById: "sam" }, toReview: { id: "x", title: "X" } })).toBe("confirm");
  });
  it("plan when it is my turn", () => {
    expect(step({})).toBe("plan");
  });
  it("planning needs the partner's calendar too", () => {
    expect(step({ partnerCalendar: "missing" })).toBe("partner_calendar");
  });
  it("suggestion mode: the proposal is everyone's step", () => {
    expect(step({ cycle: { status: "open", mode: "suggestion", plannerId: null } })).toBe("suggestion");
  });
  it("planning comes before reviewing, reviewing before waiting", () => {
    expect(step({ toReview: { id: "x", title: "X" } })).toBe("plan");
    expect(step({ cycle: { status: "open", mode: "alternating", plannerId: "sam" }, toReview: { id: "x", title: "X" } })).toBe("review");
  });
  it("waiting for the partner's Passt!", () => {
    expect(step({ cycle: { status: "planned", mode: "alternating", plannerId: "jonas" }, upcoming: { id: "d", status: "planned", proposedById: "jonas" } })).toBe("wait_confirm");
  });
  it("date ahead once confirmed", () => {
    expect(step({ cycle: { status: "confirmed", mode: "alternating", plannerId: "jonas" }, upcoming: { id: "d", status: "confirmed", proposedById: "jonas" } })).toBe("date_ahead");
  });
  it("partner's turn", () => {
    expect(step({ cycle: { status: "open", mode: "alternating", plannerId: "sam" } })).toBe("partner_turn");
  });
  it("round over", () => {
    expect(nextStep({ ...base, cycle: { status: "done", mode: "alternating", plannerId: "jonas" } })).toEqual({ kind: "round_done", skipped: false });
    expect(nextStep({ ...base, cycle: { status: "skipped", mode: "alternating", plannerId: "jonas" } })).toEqual({ kind: "round_done", skipped: true });
  });
});

describe("periodLabel", () => {
  const d = (s: string) => new Date(`${s}T00:00:00+02:00`);
  it.each([
    ["2026-10-12", "2026-10-19", "Diese Woche"],
    ["2026-10-12", "2026-10-26", "Diese zwei Wochen"],
    ["2026-10-16", "2026-11-01", "Diese Monatshälfte"],
    ["2026-10-01", "2026-11-01", "Dieser Monat"],
  ])("%s – %s", (a, b, label) => expect(periodLabel(d(a), d(b))).toBe(label));
});
