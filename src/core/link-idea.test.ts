import { describe, expect, it } from "vitest";
import { cleanLinkIdea, detectPlatform, extractUrl, fallbackIdea, linkPrompt, parseOpenGraph, type LinkMeta } from "./link-idea";

describe("extractUrl", () => {
  it("finds the link in a share text", () => {
    expect(extractUrl("Schau mal! https://vm.tiktok.com/ZMabc123/ 😍")).toBe("https://vm.tiktok.com/ZMabc123/");
  });
  it("drops trailing punctuation", () => {
    expect(extractUrl("(https://example.com/kino).")).toBe("https://example.com/kino");
  });
  it("null without a link", () => {
    expect(extractUrl("Picknick im Stadtwald")).toBeNull();
    expect(extractUrl(null)).toBeNull();
  });
});

describe("detectPlatform", () => {
  it.each([
    ["https://www.tiktok.com/@kino/video/123", "tiktok"],
    ["https://vm.tiktok.com/ZMabc/", "tiktok"],
    ["https://youtu.be/abc", "youtube"],
    ["https://www.instagram.com/reel/xyz/", "instagram"],
    ["https://www.kino.de/film/x", "web"],
    ["https://nottiktok.com/x", "web"],
  ])("%s → %s", (url, platform) => expect(detectPlatform(url)).toBe(platform));
});

describe("parseOpenGraph", () => {
  it("reads og tags, decodes entities, makes the image absolute", () => {
    const html = `<html><head><title>Fallback</title>
      <meta property="og:title" content="Dune &amp; Popcorn">
      <meta content="Ab 23.10. im Kino" property="og:description">
      <meta property="og:image" content="/img/poster.jpg"><meta property="og:site_name" content="Kino Köln"></head></html>`;
    expect(parseOpenGraph(html, "https://kino.example/film")).toEqual({
      title: "Dune & Popcorn",
      description: "Ab 23.10. im Kino",
      siteName: "Kino Köln",
      image: "https://kino.example/img/poster.jpg",
    });
  });
  it("falls back to <title> and ignores javascript: images", () => {
    expect(parseOpenGraph(`<title>Nur Titel</title><meta property="og:image" content="javascript:alert(1)">`, "https://x.example/")).toMatchObject({
      title: "Nur Titel",
      image: null,
    });
  });
  it("stays fast on hostile markup", () => {
    const started = performance.now();
    parseOpenGraph("<meta ".repeat(200_000), "https://x.example/");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

const meta: LinkMeta = {
  platform: "tiktok",
  title: "Der neue Dune-Film läuft ab Donnerstag! Wer kommt mit? #kino #köln",
  description: null,
  author: "@kinofan",
  siteName: null,
  image: "https://p16.tiktokcdn.com/thumb.jpg",
  text: null,
};

describe("fallbackIdea", () => {
  it("first sentence of the caption as title, author in the note", () => {
    expect(fallbackIdea(meta, "https://vm.tiktok.com/x")).toEqual({
      title: "Der neue Dune-Film läuft ab Donnerstag!",
      size: "small",
      note: "via @kinofan",
      costEur: null,
      location: null,
      url: "https://vm.tiktok.com/x",
    });
  });
});

describe("linkPrompt", () => {
  it("wraps the post content as data", () => {
    const prompt = linkPrompt(meta, "https://vm.tiktok.com/x");
    expect(prompt).toContain("Platform: TikTok");
    expect(prompt).toMatch(/<post>\nTitle \/ caption: Der neue Dune-Film[\s\S]*<\/post>/);
    expect(prompt).toContain("attached image");
  });
});

describe("cleanLinkIdea", () => {
  it("normalizes Claude's answer and keeps the link", () => {
    expect(
      cleanLinkIdea({ title: "  Kino: Dune ", size: "small", note: "Neuer Film, ab Do im Kino.", cost_eur: 26.4, location: "Cinedom" }, meta, "https://vm.tiktok.com/x"),
    ).toEqual({ title: "Kino: Dune", size: "small", note: "Neuer Film, ab Do im Kino. · via @kinofan", costEur: 26, location: "Cinedom", url: "https://vm.tiktok.com/x" });
  });
  it("empty title → fallback from the caption", () => {
    expect(cleanLinkIdea({ title: " ", size: "huge", note: null, cost_eur: -3, location: null }, meta, "https://x").title).toBe("Der neue Dune-Film läuft ab Donnerstag!");
  });
});
