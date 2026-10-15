import { describe, expect, it } from "vitest";
import { feedToText, findFeedLink, guessFeedUrl, parseFeed } from "./feeds";

const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Mit Vergnügen Köln</title><link>https://koeln.example/</link>
<item><title>11 Dinge f&#252;rs Wochenende</title><link>https://koeln.example/2026/wochenende/</link>
<pubDate>Thu, 15 Oct 2026 08:00:00 +0000</pubDate><description><![CDATA[Kurz]]></description>
<content:encoded><![CDATA[<h2>Lichterfest im Rheinpark</h2><p>Samstag ab 18 Uhr, <a href="/lichterfest">mehr</a></p><script>x()</script>]]></content:encoded></item>
<item><title>Neue Cafés</title><link>https://koeln.example/cafes/</link><description>&lt;p&gt;Bester Käsekuchen&lt;/p&gt;</description></item>
</channel></rss>`;

describe("feeds", () => {
  it("finds the feed link, not the comments feed", () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" title="Kommentare" href="/comments/feed/"><link rel="alternate" type="application/rss+xml" href="/feed/"></head>`;
    expect(findFeedLink(html, "https://koeln.example/x")).toBe("https://koeln.example/feed/");
    expect(findFeedLink("<head></head>", "https://koeln.example/")).toBeNull();
    expect(guessFeedUrl("https://koeln.example/some/page")).toBe("https://koeln.example/feed/");
  });

  it("reads RSS items with full content", () => {
    const items = parseFeed(rss, "https://koeln.example/");
    expect(items.map((i) => [i.title, i.link])).toEqual([
      ["11 Dinge fürs Wochenende", "https://koeln.example/2026/wochenende/"],
      ["Neue Cafés", "https://koeln.example/cafes/"],
    ]);
    expect(items[0].html).toContain("Lichterfest");
    expect(items[1].html).toContain("<p>Bester Käsekuchen</p>");
  });

  it("reads Atom entries", () => {
    const atom = `<feed><entry><title>Tipp</title><link rel="alternate" href="https://a.example/t"/><updated>2026-10-15</updated><content type="html">&lt;b&gt;Hallo&lt;/b&gt;</content></entry></feed>`;
    expect(parseFeed(atom, "https://a.example/")).toEqual([{ title: "Tipp", link: "https://a.example/t", date: "2026-10-15", html: "<b>Hallo</b>" }]);
  });

  it("text for Claude keeps links, drops scripts", () => {
    const text = feedToText(parseFeed(rss, "https://koeln.example/"), "https://koeln.example/", 5000);
    expect(text).toContain("## [11 Dinge fürs Wochenende](https://koeln.example/2026/wochenende/)");
    expect(text).toContain("[mehr](https://koeln.example/lichterfest)");
    expect(text).not.toContain("x()");
  });

  it("stays fast on hostile input", () => {
    const started = performance.now();
    parseFeed("<item><title>".repeat(100_000), "https://x.example/");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
