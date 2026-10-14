import { describe, expect, it } from "vitest";
import {
  dayLabel,
  dueSpecialReminders,
  inDaysLabel,
  nextOccurrence,
  parseSpecialDay,
  recipientsFor,
  reminderText,
  specialDayPrompt,
  upcomingSpecialDays,
  type SpecialDayRow,
} from "./special-days";

const rules = { quietHoursStartMinute: 22 * 60, quietHoursEndMinute: 8 * 60 };
const names = { j: "Jonas", s: "Sam" };
const row = (over: Partial<SpecialDayRow>): SpecialDayRow => ({ id: "x", kind: "anniversary", title: "Jahrestag", month: 10, day: 28, year: 2024, personId: null, ...over });

describe("nextOccurrence", () => {
  it("this year, today, or next year", () => {
    const now = new Date("2026-10-14T10:00:00Z");
    expect(nextOccurrence(10, 28, now).toISODate()).toBe("2026-10-28");
    expect(nextOccurrence(10, 14, now).toISODate()).toBe("2026-10-14");
    expect(nextOccurrence(3, 1, now).toISODate()).toBe("2027-03-01");
  });
  it("29 February in a normal year is the 28th", () => {
    expect(nextOccurrence(2, 29, new Date("2026-01-10T10:00:00Z")).toISODate()).toBe("2026-02-28");
    expect(nextOccurrence(2, 29, new Date("2028-01-10T10:00:00Z")).toISODate()).toBe("2028-02-29");
  });
});

describe("labels", () => {
  it("counts years", () => {
    expect(dayLabel(row({}), 2026, names)).toBe("2. Jahrestag");
    expect(dayLabel(row({ year: null }), 2026, names)).toBe("Jahrestag");
    expect(dayLabel(row({ kind: "birthday", personId: "s", year: 2001 }), 2026, names)).toBe("Sams Geburtstag (25)");
    expect(dayLabel(row({ kind: "birthday", personId: "j", year: 2001 }), 2026, { j: "Jonas" })).toBe("Jonas' Geburtstag (25)");
    expect(dayLabel(row({ kind: "other", title: "Unser erstes Date" }), 2026, names)).toBe("Unser erstes Date");
    expect(inDaysLabel(0)).toBe("heute");
    expect(inDaysLabel(12)).toBe("in 12 Tagen");
  });
  it("upcoming within N days, soonest first", () => {
    const now = new Date("2026-10-14T10:00:00Z");
    const list = upcomingSpecialDays([row({ id: "a" }), row({ id: "b", kind: "birthday", personId: "s", month: 10, day: 16 }), row({ id: "c", month: 12, day: 24 })], now, 21, names);
    expect(list.map((d) => [d.id, d.days])).toEqual([
      ["b", 2],
      ["a", 14],
    ]);
  });
});

describe("reminders", () => {
  it("a birthday goes only to the other one", () => {
    expect(recipientsFor({ kind: "birthday", personId: "s" }, ["j", "s"])).toEqual(["j"]);
    expect(recipientsFor({ kind: "anniversary", personId: null }, ["j", "s"])).toEqual(["j", "s"]);
  });
  it("14 and 2 days before at 10:00 Berlin, not too late", () => {
    const day = row({ month: 10, day: 28 });
    expect(dueSpecialReminders([day], new Date("2026-10-14T07:59:00Z"), ["j", "s"], rules)).toEqual([]); // 09:59
    const due = dueSpecialReminders([day], new Date("2026-10-14T08:05:00Z"), ["j", "s"], rules);
    expect(due.map((r) => [r.userId, r.refId, r.daysBefore])).toEqual([
      ["j", "x@2026-10-28@14", 14],
      ["s", "x@2026-10-28@14", 14],
    ]);
    expect(dueSpecialReminders([day], new Date("2026-10-14T11:00:00Z"), ["j", "s"], rules)).toEqual([]); // 3 h late
    expect(dueSpecialReminders([day], new Date("2026-10-26T09:00:00Z"), ["j", "s"], rules).map((r) => r.daysBefore)).toEqual([2, 2]);
  });
  it("texts", () => {
    const anniversary = { id: "x", kind: "anniversary" as const, label: "2. Jahrestag", date: new Date(), days: 14, personId: null, emoji: "💞" };
    expect(reminderText(anniversary, 14, 120)).toEqual({ title: "2. Jahrestag ist in 2 Wochen 💞", body: "Wie wär's mit einem großen Date? Im Spartopf: 120 € 🎁" });
    expect(reminderText({ ...anniversary, kind: "birthday", label: "Sams Geburtstag", emoji: "🎂" }, 2, null).title).toBe("Sams Geburtstag ist übermorgen 🎂");
    expect(specialDayPrompt([{ ...anniversary, days: 12 }])).toContain("their anniversary in 12 days");
    expect(specialDayPrompt([{ ...anniversary, days: 40 }])).toBeNull();
  });
});

describe("parseSpecialDay", () => {
  it("valid kinds", () => {
    expect(parseSpecialDay({ kind: "anniversary", title: "", date: "2024-10-28" }, ["j", "s"])).toEqual({ kind: "anniversary", title: "Jahrestag", month: 10, day: 28, year: 2024, personId: null });
    expect(parseSpecialDay({ kind: "birthday:s", title: "", date: "2001-03-05" }, ["j", "s"])).toMatchObject({ kind: "birthday", personId: "s", month: 3, day: 5 });
    expect(parseSpecialDay({ kind: "other", title: "  Erstes   Date ", date: "2024-09-01" }, ["j", "s"])).toMatchObject({ title: "Erstes Date" });
  });
  it("errors", () => {
    expect(parseSpecialDay({ kind: "birthday:eve", title: "", date: "2001-03-05" }, ["j", "s"])).toHaveProperty("error");
    expect(parseSpecialDay({ kind: "other", title: "", date: "2001-03-05" }, ["j", "s"])).toHaveProperty("error");
    expect(parseSpecialDay({ kind: "anniversary", title: "", date: "kaputt" }, ["j", "s"])).toHaveProperty("error");
    expect(parseSpecialDay({ kind: "party", title: "", date: "2001-03-05" }, ["j", "s"])).toHaveProperty("error");
  });
});
