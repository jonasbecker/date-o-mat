import { describe, expect, it } from "vitest";
import { overallLevel, statusRows, tickHealth, type StatusFacts } from "./system-status";

const now = new Date("2026-10-14T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("tickHealth", () => {
  it.each([
    [null, "never"],
    [3, "ok"],
    [15, "ok"],
    [16, "late"],
    [60, "late"],
    [61, "stale"],
  ] as const)("%s min ago → %s", (m, health) => expect(tickHealth(m === null ? null : minutesAgo(m), now)).toBe(health));
});

const facts = (over: Partial<StatusFacts> = {}): StatusFacts => ({
  now,
  tick: { at: minutesAgo(3), errors: 0 },
  cronConfigured: true,
  calendars: [
    { name: "Jonas", me: true, status: "ok" },
    { name: "Sam", me: false, status: "ok" },
  ],
  push: { configured: true, devices: [{ name: "Jonas", count: 1 }, { name: "Sam", count: 2 }] },
  sources: { count: 4, failing: 0 },
  ai: { configured: true, used: { ideas: 2, events: 5, links: 1 }, limits: { ideas: 20, events: 40, links: 30 } },
  photos: "blob",
  ...over,
});
const row = (f: StatusFacts, key: string) => statusRows(f).find((r) => r.key === key)!;

describe("statusRows", () => {
  it("all fine", () => {
    const rows = statusRows(facts());
    expect(overallLevel(rows)).toBe("ok");
    expect(row(facts(), "tick").detail).toBe("Läuft – zuletzt vor 3 Min.");
    expect(row(facts(), "push").detail).toBe("Jonas: 1 Gerät · Sam: 2 Geräte");
    expect(row(facts(), "ai").detail).toBe("Heute: Ideen 2/20 · Links 1/30 · Events 5/40");
  });

  it("a cron that stopped is a warning", () => {
    const f = facts({ tick: { at: minutesAgo(180), errors: 0 } });
    expect(row(f, "tick")).toMatchObject({ level: "warn", detail: expect.stringContaining("Zuletzt vor 3 Std.") });
    expect(overallLevel(statusRows(f))).toBe("warn");
    expect(row(facts({ tick: null }), "tick").detail).toContain("Noch nie gelaufen");
    expect(row(facts({ cronConfigured: false }), "tick").detail).toContain("CRON_SECRET");
  });

  it("lost calendars: own one links to reconnect, partner's names who has to act", () => {
    const f = facts({
      calendars: [
        { name: "Jonas", me: true, status: "needs_reauth" },
        { name: "Sam", me: false, status: "missing" },
      ],
    });
    expect(row(f, "calendar-me")).toMatchObject({ level: "warn", href: "/settings#kalender", detail: "Verbindung verloren – bitte neu verbinden." });
    expect(row(f, "calendar-partner")).toMatchObject({ label: "Kalender von Sam", detail: "Nicht verbunden – Sam muss ihn in den Einstellungen neu verbinden." });
  });

  it("features that are not set up are 'off', not a warning", () => {
    const f = facts({ ai: { ...facts().ai, configured: false }, photos: null, sources: { count: 0, failing: 0 }, push: { configured: false, devices: [] } });
    expect(overallLevel(statusRows(f))).toBe("ok");
    expect(row(f, "photos").level).toBe("off");
  });

  it("limit reached and failing sources are warnings", () => {
    expect(row(facts({ ai: { ...facts().ai, used: { ideas: 20, events: 0, links: 0 } } }), "ai").level).toBe("warn");
    expect(row(facts({ sources: { count: 4, failing: 1 } }), "sources").detail).toBe("4 Seiten, 1 mit Fehler");
    expect(row(facts({ push: { configured: true, devices: [{ name: "Jonas", count: 0 }, { name: "Sam", count: 1 }] } }), "push").level).toBe("warn");
  });
});
