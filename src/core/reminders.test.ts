import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { dueReminders, outOfQuietHours, plannedReminders, type ReminderCycle } from "./reminders";

const ZONE = "Europe/Berlin";
const at = (s: string) => DateTime.fromISO(s, { zone: ZONE }).toJSDate();
const show = (d: Date) => DateTime.fromJSDate(d, { zone: ZONE }).toFormat("yyyy-LL-dd HH:mm");
const RULES = { quietHoursStartMinute: 22 * 60, quietHoursEndMinute: 8 * 60 };
const USERS: [string, string] = ["jonas", "sam"];

const cycle: ReminderCycle = {
  id: "c1",
  seq: 1,
  startsAt: at("2026-10-12T00:00"),
  deadlineAt: at("2026-10-15T20:00"),
  mode: "alternating",
  plannerId: "jonas",
  status: "open",
};

describe("outOfQuietHours", () => {
  it("leaves daytime alone", () => {
    expect(show(outOfQuietHours(at("2026-10-12T15:00"), RULES))).toBe("2026-10-12 15:00");
  });
  it("moves late evening to the next morning", () => {
    expect(show(outOfQuietHours(at("2026-10-12T23:30"), RULES))).toBe("2026-10-13 08:00");
  });
  it("moves early morning to 08:00 the same day", () => {
    expect(show(outOfQuietHours(at("2026-10-13T05:00"), RULES))).toBe("2026-10-13 08:00");
  });
  it("works on the DST night", () => {
    expect(show(outOfQuietHours(at("2026-10-25T02:30"), RULES))).toBe("2026-10-25 08:00");
  });
});

describe("plannedReminders – rounds", () => {
  it("alternating: only the planner, turn at 09:00 and 24 h before the deadline", () => {
    const list = plannedReminders({ cycle, date: null, userIds: USERS, rules: RULES });
    expect(list.map((r) => [r.userId, r.type, show(r.dueAt)])).toEqual([
      ["jonas", "turn_started", "2026-10-12 09:00"],
      ["jonas", "deadline_soon", "2026-10-14 20:00"],
    ]);
  });

  it("suggestion mode: both partners", () => {
    const list = plannedReminders({ cycle: { ...cycle, mode: "suggestion", plannerId: null }, date: null, userIds: USERS, rules: RULES });
    expect(list.filter((r) => r.type === "turn_started").map((r) => r.userId)).toEqual(["jonas", "sam"]);
  });

  it("nothing about planning once the round has a date", () => {
    expect(plannedReminders({ cycle: { ...cycle, status: "planned" }, date: null, userIds: USERS, rules: RULES })).toEqual([]);
  });

  it("skips the deadline reminder when the deadline is too close to the start", () => {
    const short = { ...cycle, deadlineAt: at("2026-10-12T20:00") };
    const list = plannedReminders({ cycle: short, date: null, userIds: USERS, rules: RULES });
    expect(list.map((r) => r.type)).toEqual(["turn_started"]);
  });
});

describe("plannedReminders – dates", () => {
  const date = { id: "d1", startsAt: at("2026-10-16T18:30"), status: "confirmed" as const };

  it("reminds both the evening before at 19:00 and 2 hours before", () => {
    const list = plannedReminders({ cycle: null, date, userIds: USERS, rules: RULES });
    expect(list.map((r) => [r.userId, r.type, show(r.dueAt)])).toEqual([
      ["jonas", "date_tomorrow", "2026-10-15 19:00"],
      ["jonas", "date_soon", "2026-10-16 16:30"],
      ["sam", "date_tomorrow", "2026-10-15 19:00"],
      ["sam", "date_soon", "2026-10-16 16:30"],
    ]);
  });

  it("a moved date gets new reminders (new ref)", () => {
    const [a] = plannedReminders({ cycle: null, date, userIds: USERS, rules: RULES });
    const [b] = plannedReminders({ cycle: null, date: { ...date, startsAt: at("2026-10-17T15:00") }, userIds: USERS, rules: RULES });
    expect(a.refId).not.toBe(b.refId);
  });

  it("'in 2 hours' ignores quiet hours (morning dates)", () => {
    const list = plannedReminders({ cycle: null, date: { ...date, startsAt: at("2026-10-17T09:00") }, userIds: USERS, rules: RULES });
    expect(show(list.find((r) => r.type === "date_soon")!.dueAt)).toBe("2026-10-17 07:00");
  });

  it("keeps wall-clock time across DST (date on Sunday 25 Oct)", () => {
    const list = plannedReminders({ cycle: null, date: { ...date, startsAt: at("2026-10-25T15:00") }, userIds: USERS, rules: RULES });
    expect(show(list.find((r) => r.type === "date_tomorrow")!.dueAt)).toBe("2026-10-24 19:00");
  });

  it("cancelled dates remind nobody", () => {
    expect(plannedReminders({ cycle: null, date: { ...date, status: "cancelled" }, userIds: USERS, rules: RULES })).toEqual([]);
  });
});

describe("dueReminders", () => {
  const date = { id: "d1", startsAt: at("2026-10-16T18:30"), status: "confirmed" as const };
  const due = (now: string) =>
    dueReminders({ now: at(now), cycle, date, userIds: USERS, rules: RULES }).map((r) => `${r.userId}:${r.type}`);

  it("nothing before it is time", () => {
    expect(due("2026-10-12T08:59")).toEqual([]);
  });
  it("sends when due", () => {
    expect(due("2026-10-12T09:05")).toEqual(["jonas:turn_started"]);
  });
  it("still sends a little late (missed tick), but not hours later", () => {
    expect(due("2026-10-12T10:30")).toEqual(["jonas:turn_started"]);
    expect(due("2026-10-12T11:30")).toEqual([]);
  });
  it("the evening before and two hours before", () => {
    expect(due("2026-10-15T19:02")).toEqual(["jonas:date_tomorrow", "sam:date_tomorrow"]);
    expect(due("2026-10-16T16:31")).toEqual(["jonas:date_soon", "sam:date_soon"]);
  });
  it("never after the date started", () => {
    expect(dueReminders({ now: at("2026-10-16T18:31"), cycle: null, date: { ...date, startsAt: at("2026-10-16T18:30") }, userIds: USERS, rules: RULES })).toEqual([]);
  });
});

describe("plannedReminders – review", () => {
  const past = { id: "d9", startsAt: at("2026-10-16T19:00"), endsAt: at("2026-10-16T22:00"), reviewedBy: ["sam"] };

  it("asks only the person who has not reviewed yet, the next day at 11:00", () => {
    const list = plannedReminders({ cycle: null, date: null, reviewDates: [past], userIds: USERS, rules: RULES });
    expect(list.map((r) => [r.userId, r.type, r.refId, show(r.dueAt)])).toEqual([["jonas", "review_due", "d9", "2026-10-17 11:00"]]);
  });

  it("respects quiet hours when a date ends late at night", () => {
    const late = { id: "d10", startsAt: at("2026-10-16T20:00"), endsAt: at("2026-10-17T21:30"), reviewedBy: [] };
    const list = plannedReminders({ cycle: null, date: null, reviewDates: [late], userIds: USERS, rules: RULES });
    expect(list.map((r) => show(r.dueAt))).toEqual(["2026-10-18 08:00", "2026-10-18 08:00"]);
  });

  it("is due only within the lateness window", () => {
    const params = { cycle: null, date: null, reviewDates: [past], userIds: USERS, rules: RULES };
    expect(dueReminders({ ...params, now: at("2026-10-17T10:59") })).toHaveLength(0);
    expect(dueReminders({ ...params, now: at("2026-10-17T11:05") })).toHaveLength(1);
    expect(dueReminders({ ...params, now: at("2026-10-17T14:00") })).toHaveLength(0);
  });
});
