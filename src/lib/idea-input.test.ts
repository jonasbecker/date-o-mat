import { describe, expect, it } from "vitest";
import { displayHost, formatCost, normalizeUrl, parseCost, parseIdeaInput } from "./idea-input";

describe("parseIdeaInput", () => {
  it("accepts the minimal quick-add input (title + size)", () => {
    expect(parseIdeaInput({ title: "  Picknick im Stadtwald ", size: "small" })).toEqual({
      ok: true,
      data: { title: "Picknick im Stadtwald", size: "small", note: null, url: null, costEur: null, location: null },
    });
  });

  it("parses all optional fields", () => {
    const result = parseIdeaInput({
      title: "Bouldern",
      size: "large",
      note: " Schuhe leihen ",
      url: "boulderwelt.de/koeln",
      costEur: "12,50 €",
      location: "Köln-Ehrenfeld",
    });
    expect(result).toEqual({
      ok: true,
      data: {
        title: "Bouldern",
        size: "large",
        note: "Schuhe leihen",
        url: "https://boulderwelt.de/koeln",
        costEur: 13,
        location: "Köln-Ehrenfeld",
      },
    });
  });

  it("requires a title and a valid size", () => {
    const result = parseIdeaInput({ title: "   ", size: "huge" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeDefined();
      expect(result.errors.size).toBeDefined();
    }
  });

  it("reports invalid optional fields", () => {
    const result = parseIdeaInput({ title: "Kino", size: "small", url: "javascript:alert(1)", costEur: "viel" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.url).toBeDefined();
      expect(result.errors.costEur).toBeDefined();
    }
  });

  it("rejects overly long titles", () => {
    expect(parseIdeaInput({ title: "x".repeat(121), size: "small" }).ok).toBe(false);
  });

  it("treats free dates as cost 0", () => {
    const result = parseIdeaInput({ title: "Spaziergang", size: "small", costEur: "0" });
    expect(result.ok && result.data.costEur).toBe(0);
  });
});

describe("normalizeUrl", () => {
  it.each([
    ["example.com", "https://example.com/"],
    ["http://example.com/a?b=1", "http://example.com/a?b=1"],
    ["https://www.kino.de/film", "https://www.kino.de/film"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each(["javascript:alert(1)", "ftp://example.com", "mailto:a@b.de", "nur text", "localhost"])("rejects %j", (input) => {
    expect(normalizeUrl(input)).toBeNull();
  });
});

describe("parseCost", () => {
  it.each([
    ["", null],
    ["15", 15],
    ["15 €", 15],
    ["12,49", 12],
    ["0", 0],
  ])("parses %j", (input, expected) => {
    expect(parseCost(input)).toBe(expected);
  });

  it("returns NaN for text", () => {
    expect(parseCost("zehn")).toBeNaN();
    expect(parseCost("-5")).toBeNaN();
  });
});

describe("formatting", () => {
  it("formats costs", () => {
    expect(formatCost(null)).toBeNull();
    expect(formatCost(0)).toBe("kostenlos");
    expect(formatCost(15)).toBe("~15 €");
  });

  it("shows only the host of a link", () => {
    expect(displayHost("https://www.example.com/path?x=1")).toBe("example.com");
  });
});
