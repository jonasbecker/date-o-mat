// RSS/Atom feeds as a second way into a website: many magazines (WordPress)
// block automated page requests or render with JavaScript, but publish a feed
// with the full articles. Pure and bounded, like the HTML helpers.

import { decodeEntities, htmlToText, MAX_HTML } from "./events";

export type FeedItem = { title: string; link: string | null; date: string | null; html: string };

const MAX_ITEMS = 12;
const MAX_ITEM = 200_000;

function absolute(href: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** <link rel="alternate" type="application/rss+xml" href="…"> in the page head. */
export function findFeedLink(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 300_000);
  const tag = /<link\b([^<>]{0,1000})>/gi;
  for (let m = tag.exec(head); m; m = tag.exec(head)) {
    const attrs = m[1];
    if (!/rel\s*=\s*["']?alternate/i.test(attrs) || !/type\s*=\s*["']?application\/(rss|atom)\+xml/i.test(attrs)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    // Comment feeds ("Kommentare zu …") are no use.
    if (href && !/comments/i.test(href)) return absolute(href, baseUrl);
  }
  return null;
}

/** WordPress and many other CMS publish the feed here. */
export function guessFeedUrl(pageUrl: string): string | null {
  try {
    return new URL("/feed/", pageUrl).toString();
  } catch {
    return null;
  }
}

function inner(block: string, names: string[]): string | null {
  for (const name of names) {
    const m = new RegExp(`<${name}\\b[^<>]{0,500}>([\\s\\S]{0,${MAX_ITEM}}?)</${name}>`, "i").exec(block);
    if (m) return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
  }
  return null;
}

/** Items of an RSS 2.0 or Atom feed (newest first, as published). */
export function parseFeed(xml: string, baseUrl: string): FeedItem[] {
  const s = xml.slice(0, MAX_HTML);
  const lower = s.toLowerCase();
  const isAtom = !lower.includes("<item") && lower.includes("<entry");
  const open = isAtom ? "<entry" : "<item";
  const close = isAtom ? "</entry>" : "</item>";
  const items: FeedItem[] = [];
  for (let start = lower.indexOf(open); start !== -1 && items.length < MAX_ITEMS; start = lower.indexOf(open, start + 1)) {
    const end = lower.indexOf(close, start);
    if (end === -1) break;
    const block = s.slice(start, Math.min(end, start + MAX_ITEM));
    const title = decodeEntities((inner(block, ["title"]) ?? "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
    if (!title) continue;
    const atomLink = isAtom ? /<link\b[^<>]{0,500}href\s*=\s*["']([^"']+)["']/i.exec(block)?.[1] : null;
    const link = absolute(atomLink ?? inner(block, ["link"]) ?? "", baseUrl);
    const date = inner(block, ["pubDate", "published", "updated", "dc:date"])?.trim() ?? null;
    const html = inner(block, ["content:encoded", "content", "description", "summary"]) ?? "";
    items.push({ title, link, date, html: html.includes("<") || !html.includes("&lt;") ? html : decodeEntities(html) });
    start = end;
  }
  return items;
}

/** One text for Claude: every article as "## [title](link) (date)" plus its readable text. */
export function feedToText(items: FeedItem[], baseUrl: string, maxLength: number): string {
  const per = Math.max(800, Math.floor(maxLength / Math.max(1, items.length)));
  const parts = items.map((item) => {
    const head = `## ${item.link ? `[${item.title}](${item.link})` : item.title}${item.date ? ` (${item.date})` : ""}`;
    return `${head}\n${htmlToText(item.html, item.link ?? baseUrl, per)}`;
  });
  const text = parts.join("\n\n");
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}
