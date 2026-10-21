import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { alignedCycleStart, cycleDeadline, cycleEnd, cycleStatus, plannerForSeq } from "./cycles";

const ZONE = "Europe/Berlin";
const at = (local: string) => DateTime.fromISO(local, { zone: ZONE }).toJSDate();
const local = (date: Date) => DateTime.fromJSDate(date, { zone: ZONE }).toFormat("yyyy-LL-dd'T'HH:mm ccc");

describe("alignedCycleStart", () => {
  it("weekly and biweekly rounds start on Monday 00:00", () => {
    expect(local(alignedCycleStart("weekly", at("2026-10-15T13:00")))).toBe("2026-10-12T00:00 Mon");
    expect(local(alignedCycleStart("biweekly", at("2026-10-18T23:59")))).toBe("2026-10-12T00:00 Mon");
  });

  it("twice a month starts on the 1st or the 16th", () => {
    expect(local(alignedCycleStart("semimonthly", at("2026-10-15T23:00")))).toBe("2026-10-01T00:00 Thu");
    expect(local(alignedCycleStart("semimonthly", at("2026-10-16T00:30")))).toBe("2026-10-16T00:00 Fri");
  });

  it("monthly starts on the 1st", () => {
    expect(local(alignedCycleStart("monthly", at("2026-10-31T12:00")))).toBe("2026-10-01T00:00 Thu");
  });
});

describe("cycleEnd", () => {
  it("weekly: Monday to next Monday", () => {
    expect(local(cycleEnd("weekly", at("2026-10-12T00:00")))).toBe("2026-10-19T00:00 Mon");
  });

  it("biweekly: two weeks", () => {
    expect(local(cycleEnd("biweekly", at("2026-10-12T00:00")))).toBe("2026-10-26T00:00 Mon");
  });

  it("semimonthly: 1st → 16th → 1st, also in February", () => {
    expect(local(cycleEnd("semimonthly", at("2026-10-01T00:00")))).toBe("2026-10-16T00:00 Fri");
    expect(local(cycleEnd("semimonthly", at("2026-10-16T00:00")))).toBe("2026-11-01T00:00 Sun");
    expect(local(cycleEnd("semimonthly", at("2027-02-16T00:00")))).toBe("2027-03-01T00:00 Mon");
  });

  it("monthly: to the next 1st", () => {
    expect(local(cycleEnd("monthly", at("2027-02-01T00:00")))).toBe("2027-03-01T00:00 Mon");
  });

  it("keeps local midnight across the DST switch (week of 25 Oct 2026 has 169 hours)", () => {
    const start = at("2026-10-19T00:00");
    const end = cycleEnd("weekly", start);
    expect(local(end)).toBe("2026-10-26T00:00 Mon");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(169);
  });

  it("after a rhythm change mid-week, the round is never shorter than the minimum", () => {
    // switching to weekly on a Saturday: not 2 days until Monday, but 9
    expect(local(cycleEnd("weekly", at("2026-10-17T00:00")))).toBe("2026-10-26T00:00 Mon");
    // switching to biweekly on a Wednesday: 12 days to a Monday
    expect(local(cycleEnd("biweekly", at("2026-10-14T00:00")))).toBe("2026-10-26T00:00 Mon");
    // switching to twice a month on the 14th
    expect(local(cycleEnd("semimonthly", at("2026-10-14T00:00")))).toBe("2026-11-01T00:00 Sun");
  });
});

describe("cycleDeadline", () => {
  it("weekly default: Thursday 20:00", () => {
    const deadline = cycleDeadline(at("2026-10-12T00:00"), at("2026-10-19T00:00"), 3, 20 * 60);
    expect(local(deadline)).toBe("2026-10-15T20:00 Thu");
  });

  it("is never earlier than 12 hours into the round", () => {
    const start = at("2026-10-12T00:00");
    const deadline = cycleDeadline(start, at("2026-10-15T00:00"), 10, 20 * 60);
    expect(deadline.getTime()).toBe(start.getTime() + 12 * 3_600_000);
  });

  it("uses wall-clock time on DST days", () => {
    // round ending Mon 26 Oct, deadline on its last day (Sun 25, already CET)
    const deadline = cycleDeadline(at("2026-10-19T00:00"), at("2026-10-26T00:00"), 0, 20 * 60);
    expect(local(deadline)).toBe("2026-10-25T20:00 Sun");
  });
});

describe("plannerForSeq", () => {
  it("alternates every round", () => {
    expect([1, 2, 3, 4].map((seq) => plannerForSeq(seq, "jonas", "sam"))).toEqual(["jonas", "sam", "jonas", "sam"]);
  });
});

describe("cycleStatus", () => {
  const end = at("2026-10-19T00:00");
  const before = at("2026-10-16T12:00");
  const after = at("2026-10-19T08:00");

  it("is open while nothing is planned", () => {
    expect(cycleStatus({ current: "open", date: null, cycleEnd: end, now: before })).toBe("open");
  });

  it("becomes skipped when the round ends without a date", () => {
    expect(cycleStatus({ current: "open", date: null, cycleEnd: end, now: after })).toBe("skipped");
  });

  it("follows the date: planned → confirmed → done after it ended", () => {
    const date = { status: "planned" as const, endsAt: at("2026-10-17T20:00") };
    expect(cycleStatus({ current: "open", date, cycleEnd: end, now: before })).toBe("planned");
    expect(cycleStatus({ current: "planned", date: { ...date, status: "confirmed" }, cycleEnd: end, now: before })).toBe("confirmed");
    expect(cycleStatus({ current: "confirmed", date: { ...date, status: "confirmed" }, cycleEnd: end, now: after })).toBe("done");
  });

  it("keeps a round with a date after its end planned until the date happened", () => {
    const date = { status: "confirmed" as const, endsAt: at("2026-10-21T20:00") };
    expect(cycleStatus({ current: "confirmed", date, cycleEnd: end, now: after })).toBe("confirmed");
  });

  it("a cancelled date reopens the round (or skips it after the end)", () => {
    const date = { status: "cancelled" as const, endsAt: at("2026-10-17T20:00") };
    expect(cycleStatus({ current: "planned", date, cycleEnd: end, now: before })).toBe("open");
    expect(cycleStatus({ current: "planned", date, cycleEnd: end, now: after })).toBe("skipped");
  });

  it("a date nobody said yes to does not count by itself – it waits for the answer", () => {
    const date = { status: "planned" as const, endsAt: at("2026-10-17T21:00") };
    expect(cycleStatus({ current: "planned", date, cycleEnd: end, now: after })).toBe("planned");
    expect(cycleStatus({ current: "planned", date: { ...date, status: "done" }, cycleEnd: end, now: after })).toBe("done");
  });

  it("final states stay final", () => {
    expect(cycleStatus({ current: "skipped", date: null, cycleEnd: end, now: before })).toBe("skipped");
    expect(cycleStatus({ current: "done", date: null, cycleEnd: end, now: before })).toBe("done");
  });
});
