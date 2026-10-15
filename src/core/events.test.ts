import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { cleanItems, decodeEntities, eventSpan, fitsFreeTime, followUpLinks, htmlToText, jsonLdEvents, parseEventTime, sameSite } from "./events";

const ZONE = "Europe/Berlin";
const at = (s: string) => DateTime.fromISO(s, { zone: ZONE }).toJSDate();
const show = (d: Date | null) => (d ? DateTime.fromJSDate(d, { zone: ZONE }).toFormat("yyyy-LL-dd HH:mm") : null);
const NOW = at("2026-10-14T12:00");
const SOURCE = "https://rausgegangen.de/cologne/";

describe("htmlToText", () => {
  it("drops scripts, styles and navigation, keeps links as [text](url)", () => {
    const html = `<html><head><title>x</title><style>.a{}</style></head><body>
      <nav><a href="/login">Login</a></nav>
      <script>alert(1)</script>
      <h2>Jazz &amp; Wein</h2><p>Fr, 17.10. · 20:00 · <a href="/events/jazz-123">Details</a></p>
      <footer>Impressum</footer></body></html>`;
    const text = htmlToText(html, SOURCE);
    expect(text).toContain("Jazz & Wein");
    expect(text).toContain("[Details](https://rausgegangen.de/events/jazz-123)");
    expect(text).not.toMatch(/alert|Login|Impressum|\.a\{\}/);
  });
  it("cuts very long pages", () => {
    expect(htmlToText(`<p>${"a".repeat(100)}</p>`, SOURCE, 20)).toHaveLength(20);
  });
  it("ignores javascript: links", () => {
    expect(htmlToText(`<a href="javascript:alert(1)">Klick</a>`, SOURCE)).toBe("Klick");
  });
  it("decodes numeric entities", () => {
    expect(decodeEntities("K&#246;ln &#x2013; &euro;")).toBe("Köln – €");
  });
});

describe("hostile pages stay fast", () => {
  const cases = {
    "unclosed scripts": "<script ".repeat(200_000),
    "unclosed links": '<a href="/x">'.repeat(100_000),
    "links closed only at the end": '<a href="/x">x'.repeat(100_000) + "</a>",
    "lone angle brackets": "<".repeat(1_000_000),
    "unclosed comments": "<!--".repeat(300_000),
    "unclosed ld+json": '<script type="application/ld+json">{'.repeat(50_000),
  };
  for (const [name, html] of Object.entries(cases)) {
    it(name, () => {
      const started = performance.now();
      htmlToText(html, SOURCE);
      jsonLdEvents(html, SOURCE);
      followUpLinks(html, SOURCE);
      expect(performance.now() - started).toBeLessThan(1500);
    });
  }
});

describe("jsonLdEvents", () => {
  it("reads schema.org events, also inside @graph", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"MusicEvent","name":"Kammerkonzert","startDate":"2026-10-18T19:30:00+02:00",
       "location":{"@type":"Place","name":"Philharmonie"},"offers":{"price":"25","priceCurrency":"EUR"},"url":"/e/1"},
      {"@type":"Organization","name":"Nicht relevant"}]}</script>
      <script type="application/ld+json">{ kaputt </script>`;
    expect(jsonLdEvents(html, SOURCE)).toEqual([
      {
        kind: "event",
        title: "Kammerkonzert",
        starts_at: "2026-10-18T19:30:00+02:00",
        ends_at: null,
        venue: "Philharmonie",
        price: "25 €",
        url: "https://rausgegangen.de/e/1",
        summary: null,
      },
    ]);
  });
  it("free entry", () => {
    const html = `<script type="application/ld+json">[{"@type":"Event","name":"Lesung","startDate":"2026-10-20","isAccessibleForFree":true}]</script>`;
    expect(jsonLdEvents(html, SOURCE)[0].price).toBe("Eintritt frei");
  });
});

describe("parseEventTime", () => {
  it("reads Berlin wall-clock time", () => {
    expect(show(parseEventTime("2026-10-17T20:00")!.date)).toBe("2026-10-17 20:00");
  });
  it("respects an explicit offset", () => {
    expect(show(parseEventTime("2026-10-17T18:00:00Z")!.date)).toBe("2026-10-17 20:00");
  });
  it("date only means all day", () => {
    expect(parseEventTime("2026-10-17")).toEqual({ date: at("2026-10-17T00:00"), allDay: true });
  });
  it("rejects garbage", () => {
    expect(parseEventTime("nächsten Freitag")).toBeNull();
    expect(parseEventTime(null)).toBeNull();
  });
});

describe("cleanItems", () => {
  const clean = (items: Parameters<typeof cleanItems>[0], sourceKind: "calendar" | "tips" = "calendar") =>
    cleanItems(items, { sourceUrl: SOURCE, sourceKind, now: NOW });

  it("keeps upcoming events and normalizes them", () => {
    const [item] = clean([{ title: "  Jazz   im Stadtgarten ", starts_at: "2026-10-17T20:00", venue: "Stadtgarten", price: "15 €", url: "/events/1" }]);
    expect(item).toMatchObject({ kind: "event", title: "Jazz im Stadtgarten", allDay: false, venue: "Stadtgarten", priceText: "15 €", url: "https://rausgegangen.de/events/1" });
    expect(show(item.startsAt)).toBe("2026-10-17 20:00");
  });
  it("drops past, far-future and undated calendar entries", () => {
    expect(
      clean([
        { title: "Gestern", starts_at: "2026-10-13T20:00" },
        { title: "Viel später", starts_at: "2027-03-01T20:00" },
        { title: "Ohne Datum" },
        { title: "", starts_at: "2026-10-17T20:00" },
      ]),
    ).toEqual([]);
  });
  it("keeps an exhibition that started earlier but is still running", () => {
    const items = clean([{ title: "Ausstellung", starts_at: "2026-09-01", ends_at: "2026-11-30" }]);
    expect(items).toHaveLength(1);
    expect(items[0].allDay).toBe(true);
  });
  it("keeps tonight's event until it is over", () => {
    expect(clean([{ title: "Heute Mittag", starts_at: "2026-10-14T11:00" }])).toHaveLength(1);
    expect(clean([{ title: "Heute früh", starts_at: "2026-10-14T07:00" }])).toHaveLength(0);
  });
  it("tips pages: entries without a date become tips", () => {
    expect(clean([{ title: "Neues Café in Ehrenfeld", summary: "Bester Kuchen" }], "tips")[0]).toMatchObject({ kind: "tip", startsAt: null, summary: "Bester Kuchen" });
  });
  it("drops links to other sites (e.g. injected by the page)", () => {
    expect(clean([{ title: "Konzert", starts_at: "2026-10-17T20:00", url: "https://evil.example/phish" }])[0].url).toBeNull();
    expect(clean([{ title: "Konzert", starts_at: "2026-10-17T20:00", url: "https://www.rausgegangen.de/x" }])[0].url).toBe("https://www.rausgegangen.de/x");
  });
  it("removes duplicates", () => {
    expect(clean([{ title: "Kino", starts_at: "2026-10-17T20:00" }, { title: "KINO!", starts_at: "2026-10-17T20:00" }])).toHaveLength(1);
  });
  it("an end before the start is dropped", () => {
    expect(clean([{ title: "Party", starts_at: "2026-10-17T23:00", ends_at: "2026-10-17T02:00" }])[0].endsAt).toBeNull();
  });
});

describe("followUpLinks", () => {
  const page = "https://www.koeln.de/veranstaltungen/";
  it("rel=next first, then page 2/3, then listing links – same site only", () => {
    const html = `<head><link rel="next" href="/veranstaltungen/?page=2"></head><body>
      <a href="/konzert/123">Jazz im Stadtgarten</a>
      <a href="/veranstaltungen/?page=2">2</a><a href="/veranstaltungen/?page=3">3</a><a href="/veranstaltungen/?page=9">9</a>
      <a href="/veranstaltungen/wochenende/"><span>Wochenende</span></a>
      <a href="https://other.example/?page=2">2</a>
      <a href="/impressum/">Impressum</a><a href="/veranstaltungen/#top">Alle Events</a></body>`;
    expect(followUpLinks(html, page)).toEqual([
      "https://www.koeln.de/veranstaltungen/?page=2",
      "https://www.koeln.de/veranstaltungen/?page=3",
      "https://www.koeln.de/veranstaltungen/wochenende/",
    ]);
  });
  it("'Nächste Seite' and /seite/2/ paths; at most max", () => {
    const html = `<a href="/tipps/seite/2/">Nächste Seite</a><a href="/heute">Heute</a><a href="/morgen">Morgen</a>`;
    expect(followUpLinks(html, "https://koeln.mitvergnuegen.com/tipps/", 2)).toEqual(["https://koeln.mitvergnuegen.com/tipps/seite/2/", "https://koeln.mitvergnuegen.com/heute"]);
  });
  it("nothing to follow", () => {
    expect(followUpLinks(`<a href="/kino">Mehr</a>`, page)).toEqual([]);
  });
});

describe("sameSite", () => {
  it("compares the last two labels", () => {
    expect(sameSite("https://koeln.mitvergnuegen.com/a", "https://mitvergnuegen.com/")).toBe(true);
    expect(sameSite("https://koeln.de/x", "https://koelntourismus.de/")).toBe(false);
  });
});

describe("eventSpan / fitsFreeTime", () => {
  const busy = [{ start: at("2026-10-17T14:00").getTime(), end: at("2026-10-17T18:30").getTime() }];
  it("default length when the end is unknown, nothing for all-day events", () => {
    expect(eventSpan({ startsAt: at("2026-10-17T20:00"), endsAt: null, allDay: false })!.end).toEqual(at("2026-10-17T23:00"));
    expect(eventSpan({ startsAt: at("2026-10-17T00:00"), endsAt: null, allDay: true })).toBeNull();
  });
  it("checks the buffer around the event", () => {
    const span = { start: at("2026-10-17T19:00"), end: at("2026-10-17T22:00") };
    expect(fitsFreeTime(span, busy, 15)).toBe(true);
    expect(fitsFreeTime(span, busy, 45)).toBe(false);
  });
});
