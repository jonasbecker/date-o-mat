import { describe, expect, it } from "vitest";
import {
  budgetHint,
  budgetLevel,
  closeMonth,
  dateCost,
  monthKey,
  monthLabel,
  monthRange,
  monthsBetween,
  monthSpending,
  parseBudget,
  parsePriceEur,
  recapText,
  type BudgetDate,
} from "./budget";

describe("months (Berlin)", () => {
  it("monthKey uses Berlin time", () => {
    expect(monthKey(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
    expect(monthKey(new Date("2026-10-31T21:30:00Z"))).toBe("2026-10");
  });
  it("range, between, label", () => {
    expect(monthRange("2026-10")).toEqual({ start: new Date("2026-09-30T22:00:00Z"), end: new Date("2026-10-31T23:00:00Z") });
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthsBetween("2026-11", "2026-10")).toEqual([]);
    expect(monthLabel("2026-10", new Date("2026-10-14T12:00:00Z"))).toBe("Oktober");
    expect(monthLabel("2025-12", new Date("2026-01-04T12:00:00Z"))).toBe("Dezember 2025");
  });
});

const d = (iso: string, over: Partial<BudgetDate> = {}): BudgetDate => ({
  startsAt: new Date(iso),
  status: "planned",
  estimatedCostEur: 20,
  actualCostEur: null,
  fromPot: false,
  ...over,
});

describe("spending", () => {
  it("real amount beats the estimate", () => {
    expect(dateCost({ estimatedCostEur: 20, actualCostEur: 34 })).toBe(34);
    expect(dateCost({ estimatedCostEur: null, actualCostEur: null })).toBe(0);
  });
  it("splits spent, planned and pot; ignores cancelled and other months", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const dates = [
      d("2026-10-03T16:00:00Z", { status: "done", actualCostEur: 30 }),
      d("2026-10-20T16:00:00Z"),
      d("2026-10-25T16:00:00Z", { fromPot: true, estimatedCostEur: 90 }),
      d("2026-10-10T16:00:00Z", { status: "cancelled" }),
      d("2026-11-02T16:00:00Z"),
    ];
    expect(monthSpending(dates, "2026-10", now)).toEqual({ spent: 30, planned: 20, fromPot: 90, count: 3 });
  });
  it("closing a month fills or drains the pot, never below 0", () => {
    expect(closeMonth(10, 80, { spent: 50, planned: 0, fromPot: 0 })).toBe(40);
    expect(closeMonth(40, 80, { spent: 100, planned: 0, fromPot: 0 })).toBe(20);
    expect(closeMonth(40, 80, { spent: 60, planned: 0, fromPot: 50 })).toBe(10);
    expect(closeMonth(10, 80, { spent: 200, planned: 0, fromPot: 0 })).toBe(0);
  });
});

describe("hints and texts", () => {
  it("levels", () => {
    expect(budgetLevel(50, 80)).toBe("ok");
    expect(budgetLevel(20, 80)).toBe("tight");
    expect(budgetLevel(0, 80)).toBe("over");
  });
  it("budgetHint", () => {
    expect(budgetHint(25, 15)).toBe("Sprengt euer Budget (noch 15 €)");
    expect(budgetHint(10, 15)).toBeNull();
    expect(budgetHint(null, 15)).toBeNull();
    expect(budgetHint(0, 0)).toBeNull();
    expect(budgetHint(5, 0)).toBe("Euer Budget für diesen Monat ist schon ausgeschöpft");
  });
  it("recap", () => {
    expect(recapText({ month: "Oktober", count: 3, total: 72, budget: 80, potDelta: 8, pot: 48 })).toEqual({
      title: "Oktober: 3 Dates, 72 € – im Budget 💚",
      body: "8 € wandern in den Spartopf (jetzt 48 €) 🎁",
    });
    expect(recapText({ month: "Oktober", count: 1, total: 95, budget: 80, potDelta: -15, pot: 25 }).title).toBe("Oktober: 1 Date, 95 € – 15 € drüber");
    expect(recapText({ month: "Oktober", count: 0, total: 0, budget: 80, potDelta: 80, pot: 80 }).body).toContain("Zeit für ein Date?");
  });
  it.each([
    ["12 €", 24],
    ["ab 9,50 €", 19],
    ["EUR 15", 30],
    ["Eintritt frei", 0],
    ["VVK 20 Euro, AK 25 Euro", 40],
    ["Preis auf Anfrage", null],
    [null, null],
  ])("event price %s → %s for two", (text, eur) => expect(parsePriceEur(text)).toBe(eur));
  it.each([
    ["80", 80],
    ["80 €", 80],
    ["79,6", 80],
    ["", null],
    ["-5", Number.NaN],
    ["0", Number.NaN],
    ["viel", Number.NaN],
  ])("budget input %s → %s", (input, value) => expect(parseBudget(input)).toEqual(value));
});
