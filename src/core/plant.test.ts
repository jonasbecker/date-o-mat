import { describe, expect, it } from "vitest";
import { leafKinds, MAX_LEAVES, plantLayout } from "./plant";

describe("plantLayout", () => {
  it("matches the mockup for twelve leaves", () => {
    const { leaves, stemTop, budY } = plantLayout(Array(12).fill("leaf"));
    expect(leaves[0]).toMatchObject({ right: true, rx: 32, cy: 318, rotate: -28, light: true });
    expect(leaves[1]).toMatchObject({ right: false, rotate: 28, light: false });
    expect(leaves[11].cy).toBe(318 - 11 * 22);
    expect(stemTop).toBe(62);
    expect(budY).toBe(40);
  });

  it("lets a wilted leaf hang down", () => {
    const { leaves } = plantLayout(["leaf", "wilted"]);
    expect(leaves[1]).toMatchObject({ kind: "wilted", right: false, rotate: -34 });
  });

  it("keeps a bare stem with a bud when nothing grew yet", () => {
    const { leaves, budY } = plantLayout([]);
    expect(leaves).toHaveLength(0);
    expect(budY).toBeGreaterThan(250);
  });

  it("shows the latest leaves once there are many, still inside the box", () => {
    const { leaves, budY } = plantLayout(Array(30).fill("leaf"));
    expect(leaves).toHaveLength(MAX_LEAVES);
    expect(budY).toBeGreaterThan(17);
  });
});

describe("leafKinds", () => {
  it("turns rounds into leaves and marks the newest as fresh", () => {
    expect(leafKinds(["done", "skipped", "done"], true)).toEqual(["leaf", "wilted", "fresh"]);
    expect(leafKinds(["done"])).toEqual(["leaf"]);
  });
});
