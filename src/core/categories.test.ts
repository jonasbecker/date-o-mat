import { describe, expect, it } from "vitest";
import { categoryCounts, categoryFromTheme, categoryOf, inferCategory, isCategory } from "./categories";

describe("inferCategory", () => {
  it("guesses from the title", () => {
    expect(inferCategory("Picknick im Stadtwald")).toBe("food");
    expect(inferCategory("Sushi-Abend")).toBe("food");
    expect(inferCategory("Kletterhalle ausprobieren")).toBe("active");
    expect(inferCategory("Spaziergang am Rhein")).toBe("nature");
    expect(inferCategory("Museum Ludwig")).toBe("culture");
    expect(inferCategory("Töpferkurs")).toBe("creative");
    expect(inferCategory("Töpfern im Atelier")).toBe("creative");
    expect(inferCategory("Spieleabend mit Tee")).toBe("cozy");
    expect(inferCategory("Konzert: Annenmaykantereit")).toBe("events");
    expect(inferCategory("Tagesausflug nach Bonn")).toBe("trip");
  });

  it("falls back to the note when the title says nothing", () => {
    expect(inferCategory("Überraschung", "Wir gehen ins Kino")).toBe("culture");
  });

  it("knows when it does not know", () => {
    expect(inferCategory("Irgendwas Neues")).toBeNull();
  });
});

describe("categoryFromTheme", () => {
  it("maps deck themes, the rest has no category", () => {
    expect(categoryFromTheme("food")).toBe("food");
    expect(categoryFromTheme("night")).toBe("events");
    expect(categoryFromTheme("romantic")).toBe("cozy");
    expect(categoryFromTheme("free")).toBeNull();
    expect(categoryFromTheme(null)).toBeNull();
  });
});

describe("categoryOf", () => {
  it("a stored category wins over the words", () => {
    expect(categoryOf({ category: "culture", title: "Picknick" })).toBe("culture");
  });

  it("ignores garbage in the column and guesses instead", () => {
    expect(isCategory("nonsense")).toBe(false);
    expect(categoryOf({ category: "nonsense", title: "Sushi-Abend" })).toBe("food");
  });

  it("everything else is Sonstiges", () => {
    expect(categoryOf({ title: "Irgendwas Neues" })).toBe("other");
  });
});

describe("categoryCounts", () => {
  it("lists the categories that occur, in the usual order", () => {
    const counts = categoryCounts([{ title: "Sushi" }, { title: "Picknick" }, { title: "Museum" }, { title: "Zzz" }, { title: "Bouldern" }]);
    expect(counts).toEqual([
      { category: "food", count: 2 },
      { category: "culture", count: 1 },
      { category: "active", count: 1 },
      { category: "other", count: 1 },
    ]);
  });
});
