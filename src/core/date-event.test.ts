import { describe, expect, it } from "vitest";
import { buildEventBody, eventIdFor, isValidEventId } from "./date-event";

const date = {
  id: "3f2a9c1e-7b4d-4e8a-9c0f-1a2b3c4d5e6f",
  title: "Picknick im Stadtwald",
  location: "Stadtwald Köln",
  note: "Decke mitnehmen",
  url: "https://example.com/picknick",
  costEur: 0,
  startsAt: new Date("2026-10-16T16:30:00Z"),
  endsAt: new Date("2026-10-16T18:30:00Z"),
};

describe("eventIdFor", () => {
  it("is deterministic and valid for Google", () => {
    const id = eventIdFor(date.id);
    expect(id).toBe("dom3f2a9c1e7b4d4e8a9c0f1a2b3c4d5e6f");
    expect(isValidEventId(id)).toBe(true);
    expect(eventIdFor(date.id)).toBe(id);
  });

  it("rejects ids Google would refuse", () => {
    expect(isValidEventId("abc")).toBe(false);
    expect(isValidEventId("has-dash-123")).toBe(false);
    expect(isValidEventId("wxyz12345")).toBe(false);
  });
});

describe("buildEventBody", () => {
  const body = buildEventBody(date, "sam@example.com", "https://date-o-mat.vercel.app");

  it("invites the partner and names the date", () => {
    expect(body.summary).toBe("💞 Date: Picknick im Stadtwald");
    expect(body.attendees).toEqual([{ email: "sam@example.com" }]);
  });

  it("puts idea details into the description", () => {
    expect(body.description).toContain("Decke mitnehmen");
    expect(body.description).toContain("https://example.com/picknick");
    expect(body.description).toContain("Kosten: kostenlos");
    expect(body.description).toContain("https://date-o-mat.vercel.app");
    expect(body.location).toBe("Stadtwald Köln");
  });

  it("uses exact times in Berlin time zone", () => {
    expect(body.start).toEqual({ dateTime: "2026-10-16T16:30:00.000Z", timeZone: "Europe/Berlin" });
    expect(body.end.dateTime).toBe("2026-10-16T18:30:00.000Z");
  });

  it("works for a spontaneous idea without details", () => {
    const plain = buildEventBody({ ...date, location: null, note: null, url: null, costEur: null }, "sam@example.com", "https://x.app");
    expect(plain.location).toBeUndefined();
    expect(plain.description).toBe("Geplant mit dem Date-O-Mat 💞\nhttps://x.app");
  });

  it("keeps the app's id for later lookups", () => {
    expect(body.extendedProperties.private.dateOMatId).toBe(date.id);
  });
});
