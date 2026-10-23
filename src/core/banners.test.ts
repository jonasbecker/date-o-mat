import { describe, expect, it } from "vitest";
import { BANNERS, CATEGORY_MOTIF, MOTIFS, bannerOf, bannerScale, isMotif, keywordMotif, suggestMotif } from "./banners";

describe("banners", () => {
  it("76 scenes on a 350 × 110 stage, each in one of the five pastels", () => {
    expect(MOTIFS).toHaveLength(76);
    for (const scene of Object.values(BANNERS)) {
      expect(["#F6DFD3", "#DCEBD9", "#F7EBC4", "#DCE7F5", "#E6E0F2"]).toContain(scene.bg);
      expect(scene.shapes.length).toBeGreaterThan(0);
    }
  });

  it("unknown or missing → herz", () => {
    expect(bannerOf("gibtsnicht")).toBe(BANNERS.herz);
    expect(bannerOf(null)).toBe(BANNERS.herz);
    expect(bannerOf("zoo")).toBe(BANNERS.zoo);
    expect(isMotif("constructor")).toBe(false);
  });

  it("scales to fill: the larger of height and width ratio", () => {
    expect(bannerScale(350, 170)).toBeCloseTo(170 / 110);
    expect(bannerScale(366, 150)).toBeCloseTo(150 / 110);
    expect(bannerScale(700, 110)).toBe(2);
  });

  it("words → scene; specific before broad; nothing clear → herz", () => {
    const cases: Array<[string, string]> = [
      ["Yoga im Park", "yoga"],
      ["Kölner Zoo", "zoo"],
      ["1. FC Köln im Stadion", "stadion"],
      ["Phantasialand", "freizeitpark"],
      ["Shoppen auf der Ehrenstraße", "shoppen"],
      ["Kino unter Sternen", "kino"],
      ["Sterne gucken in der Wahner Heide", "sterne"],
      ["Planetarium Bochum", "planetarium"],
      ["Pizza backen", "pizza"],
      ["Picknick im Stadtwald", "picknick"],
      ["Brettspiel-Café", "spiele"],
      ["Flohmarkt am Aachener Weiher", "markt"],
      ["Eishockey: Haie", "stadion"],
      ["Schlittschuhlaufen im Park", "eislaufen"],
      ["Wanderung im Siebengebirge", "wandern"],
      ["Sonnenuntergang am Rheinboulevard", "sonnenuntergang"],
    ];
    for (const [title, motif] of cases) expect([title, keywordMotif({ title })]).toEqual([title, motif]);
    expect(suggestMotif({ title: "Etwas ganz anderes" })).toBe("herz");
    expect(suggestMotif({ title: "Hundert Sachen" })).toBe("herz");
    expect(suggestMotif({ title: "Beginnen wir" })).toBe("herz");
    expect(suggestMotif({ title: "Überraschung", note: null })).toBe("ueberraschung");
    expect(suggestMotif({ title: "Abend zu zweit", note: "mit Wein und Käse" })).toBe("wein");
  });

  it("every category's default is a real scene", () => {
    for (const motif of Object.values(CATEGORY_MOTIF)) expect(isMotif(motif)).toBe(true);
  });
});
