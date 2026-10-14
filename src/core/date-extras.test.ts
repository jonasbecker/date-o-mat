import { describe, expect, it } from "vitest";
import { CONVERSATION_CARDS, isSurpriseHidden, maskSurprise, nextCard, prepReminderAt, routeUrl, shareKeyFromHeader, suggestTasks, surpriseRevealAt } from "./date-extras";

const date = {
  surprise: true,
  organizerId: "j",
  startsAt: new Date("2026-10-24T17:00:00Z"), // Sat 19:00 Berlin
  title: "Sushi im Belgischen Viertel",
  location: "Belgisches Viertel",
  note: "Tisch auf Jonas",
  url: "https://example.com",
  surpriseHint: "Hunger mitbringen!",
};

describe("surprise", () => {
  it("revealed at midnight on the day", () => {
    expect(surpriseRevealAt(date.startsAt).toISOString()).toBe("2026-10-23T22:00:00.000Z");
  });
  it("hidden only for the other one, until the day", () => {
    const before = new Date("2026-10-23T21:59:00Z");
    expect(isSurpriseHidden(date, "s", before)).toBe(true);
    expect(isSurpriseHidden(date, "j", before)).toBe(false);
    expect(isSurpriseHidden(date, null, before)).toBe(true);
    expect(isSurpriseHidden(date, "s", new Date("2026-10-23T22:00:00Z"))).toBe(false);
    expect(isSurpriseHidden({ ...date, surprise: false }, "s", before)).toBe(false);
  });
  it("mask keeps the time, shows the hint", () => {
    const masked = maskSurprise(date, "s", new Date("2026-10-20T10:00:00Z"), "Jonas");
    expect(masked).toMatchObject({ title: "🎁 Überraschung von Jonas", location: null, note: "Hunger mitbringen!", url: null, startsAt: date.startsAt });
    expect(maskSurprise(date, "j", new Date("2026-10-20T10:00:00Z"), "Jonas")).toBe(date);
  });
});

describe("prep", () => {
  it("suggests by keywords, without duplicates", () => {
    expect(suggestTasks({ title: "Sushi-Abend", note: null, location: null })).toEqual(["Tisch reservieren"]);
    expect(suggestTasks({ title: "Kino: Dune", note: null, location: "Cinedom" })).toEqual(["Tickets kaufen"]);
    expect(suggestTasks({ title: "Tagesausflug nach Bonn", note: null, location: null })).toEqual(["Zugverbindung checken", "Wetter checken"]);
    expect(suggestTasks({ title: "Picknick am Rhein", note: null, location: null }, ["wetter checken"])).toEqual(["Decke & Snacks einpacken"]);
    expect(suggestTasks({ title: "Spieleabend zu Hause", note: null, location: null })).toEqual([]);
  });
  it("reminder at 18:00 the day before", () => {
    expect(prepReminderAt(date.startsAt).toISOString()).toBe("2026-10-23T16:00:00.000Z");
  });
});

describe("route", () => {
  it("adds Köln and the origin", () => {
    const url = new URL(routeUrl("Cinedom", "Ehrenfeld"));
    expect(url.searchParams.get("destination")).toBe("Cinedom, Köln");
    expect(url.searchParams.get("origin")).toBe("Ehrenfeld, Köln");
    expect(url.searchParams.get("travelmode")).toBe("transit");
    expect(new URL(routeUrl("Bonn Hbf", null)).searchParams.get("origin")).toBeNull();
    expect(new URL(routeUrl("Bonn Hbf", null)).searchParams.get("destination")).toBe("Bonn Hbf");
  });
});

describe("conversation cards", () => {
  it("never repeats the recent ones", () => {
    const seen = CONVERSATION_CARDS.map((_, i) => i).slice(0, -1);
    expect(nextCard(seen, () => 0)).toBe(CONVERSATION_CARDS.length - 1);
    expect(nextCard([], () => 0)).toBe(0);
  });
});

describe("share key", () => {
  it.each([
    ["Bearer dom_abcdefghijklmnopqrstuvwxyz0123456789", "dom_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["dom_abcdefghijklmnopqrstuvwxyz0123456789", "dom_abcdefghijklmnopqrstuvwxyz0123456789"],
    ["Bearer something-else", null],
    [null, null],
  ])("%s", (header, key) => expect(shareKeyFromHeader(header)).toBe(key));
});
