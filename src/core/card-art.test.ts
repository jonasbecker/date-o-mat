import { describe, expect, it } from "vitest";
import { CARD_COLOR_HEX, ILLUSTRATIONS, QUIP_MAX, cardArt, cleanCardArt, illustrationPrompt, pickQuip } from "./card-art";

describe("cleanCardArt", () => {
  it("keeps a known color, up to two known illustrations and short lower-case quips", () => {
    const art = cleanCardArt({
      color: "rose",
      illustrations: ["crepes", "mikro", "baum", "einhorn"],
      quips: { neutral: ["Crêpes UND ABBA? ich wär dabei.", "x".repeat(QUIP_MAX + 1)], like: ["jaaa!"], nope: [] },
    });
    expect(art.color).toBe("rose");
    expect(art.illustrations).toEqual(["crepes", "mikro"]);
    expect(art.quips).toEqual({ neutral: ["crêpes und abba? ich wär dabei."], like: ["jaaa!"], nope: [] });
  });

  it("drops what is unknown or empty", () => {
    expect(cleanCardArt({ color: "#ff0000", illustrations: ["einhorn"], quips: { neutral: [""] } })).toEqual({ color: null, illustrations: null, quips: null });
    expect(cleanCardArt({})).toEqual({ color: null, illustrations: null, quips: null });
  });
});

describe("cardArt", () => {
  it("uses what is stored", () => {
    const art = cardArt({ id: "a", title: "Crêpes und ABBA", color: "sky", illustrations: ["crepes", "mikro"], quips: { neutral: ["n"], like: ["l"], nope: ["x"] } });
    expect(art).toEqual({ color: "sky", hex: CARD_COLOR_HEX.sky, illustrations: ["crepes", "mikro"], quips: { neutral: ["n"], like: ["l"], nope: ["x"] } });
  });

  it("falls back to the title's picture, the category's color and quips", () => {
    const art = cardArt({ id: "a", title: "Tretboot auf dem Decksteiner Weiher" });
    expect(art.illustrations).toEqual(["boot"]);
    expect(art.quips.like.length).toBeGreaterThan(0);
    expect(art.quips.nope.length).toBeGreaterThan(0);
    const food = cardArt({ id: "b", title: "Sushi-Abend" });
    expect(food.color).toBe("rose");
    expect(food.illustrations).toEqual(["teller"]);
  });

  it("makes detail quips from cost, place and size", () => {
    const art = cardArt({ id: "a", title: "Ramen essen", costEur: 40, location: "Ehrenfeld, Venloer Str.", size: "large" });
    expect(art.quips.neutral.slice(0, 3)).toEqual(["40 € sind 8 säcke blumenerde. nur so.", "ehrenfeld? da war ich noch nie.", "einen halben tag? ich halt durch."]);
    expect(cardArt({ id: "b", title: "Spaziergang", costEur: 0 }).quips.neutral[0]).toBe("kostet nix. wie gießwasser.");
  });

  it("fills only the missing kinds", () => {
    const art = cardArt({ id: "a", title: "Kino", quips: { neutral: ["eigener spruch"] } });
    expect(art.quips.neutral).toEqual(["eigener spruch"]);
    expect(art.quips.like.length).toBeGreaterThan(0);
  });

  it("every fallback quip is short enough", () => {
    for (const title of ["Sushi", "Park", "Museum", "Klettern", "Töpfern", "Spieleabend", "Ausflug nach Bonn", "Konzert", "Irgendwas"]) {
      const { quips } = cardArt({ id: title, title, costEur: 120, location: "Belgisches Viertel", size: "large" });
      for (const q of [...quips.neutral, ...quips.like, ...quips.nope]) expect(q.length).toBeLessThanOrEqual(QUIP_MAX);
    }
  });
});

describe("pickQuip", () => {
  it("is stable per card and walks on with n", () => {
    const list = ["a", "b", "c"];
    expect(pickQuip(list, "card-1")).toBe(pickQuip(list, "card-1"));
    expect(new Set([0, 1, 2].map((n) => pickQuip(list, "card-1", n)))).toEqual(new Set(list));
    expect(pickQuip([], "x")).toBe("");
  });
});

it("the prompt lists every illustration", () => {
  for (const key of ILLUSTRATIONS) expect(illustrationPrompt()).toContain(key);
});
