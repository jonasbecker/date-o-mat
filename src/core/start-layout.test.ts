import { describe, expect, it } from "vitest";
import { teaserLabel } from "./start-layout";


describe("teaserLabel", () => {
  it("counts the cards", () => {
    expect(teaserLabel(12)).toBe("12 neue Ideen zum Swipen");
    expect(teaserLabel(1)).toBe("1 neue Idee zum Swipen");
  });

  it("offers fetching new ideas when the deck is empty", () => {
    expect(teaserLabel(0)).toBe("Neue Ideen holen");
  });
});
