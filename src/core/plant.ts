// The plant on the Beet (DESIGN.md §4): every date lived is a leaf, a skipped round a wilted one.
// Pure geometry in a 390×420 box (the mockup's coordinates) – the SVG is in components/plant.tsx.

export type LeafKind = "leaf" | "wilted" | "fresh";
export type BudState = "waiting" | "filled" | "none";

export type LeafShape = {
  kind: LeafKind;
  /** Every third leaf is the lighter green. */
  light: boolean;
  right: boolean;
  /** Ellipse: center and radii. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Rotation in degrees around the point where the leaf meets the stem. */
  rotate: number;
  ox: number;
  oy: number;
};

export const PLANT_BOX = { width: 390, height: 420 } as const;
/** More leaves than this and the plant shows the latest ones (the count says how many there are). */
export const MAX_LEAVES = 14;

const STEM_X = 195;
const FIRST_LEAF_Y = 318;
export const POT = { rimY: 334, rimHeight: 14, rimX: 120, rimWidth: 150, bodyTop: 346, bodyX: 128, bodyWidth: 134, bottom: 420 } as const;

export type PlantLayout = {
  leaves: LeafShape[];
  /** Top of the stem (y) and the center of the bud above it. */
  stemTop: number;
  budY: number;
};

/** Leaves from the bottom (oldest) to the top (newest). */
export function plantLayout(kinds: readonly LeafKind[]): PlantLayout {
  const shown = kinds.slice(-MAX_LEAVES);
  const n = shown.length;
  // 22 px between leaves, a little closer when there are many.
  const gap = n > 12 ? (22 * 12) / n : 22;
  const shrink = n > 12 ? (2.4 * 12) / n : 2.4;
  const leaves = shown.map((kind, i): LeafShape => {
    const right = i % 2 === 0;
    const width = Math.round(64 - i * shrink);
    const height = Math.round(width * 0.56);
    const cy = Math.round(FIRST_LEAF_Y - i * gap);
    const ox = right ? STEM_X + 2 : STEM_X - 2;
    // Leaves point up (±28°); a wilted one hangs down (±34°).
    const rotate = kind === "wilted" ? (right ? 34 : -34) : right ? -28 : 28;
    return {
      kind,
      light: i % 3 === 0,
      right,
      cx: right ? ox + width / 2 : ox - width / 2,
      cy,
      rx: width / 2,
      ry: height / 2,
      rotate,
      ox,
      oy: cy,
    };
  });
  const topLeaf = leaves.at(-1)?.cy ?? FIRST_LEAF_Y + 8;
  const stemTop = topLeaf - 14;
  return { leaves, stemTop, budY: stemTop - 22 };
}

/** The leaves of a couple's plant: one per lived date, a wilted one per skipped round. */
export function leafKinds(rounds: readonly ("done" | "skipped")[], freshLast = false): LeafKind[] {
  return rounds.map((r, i) => (r === "skipped" ? "wilted" : freshLast && i === rounds.length - 1 ? "fresh" : "leaf"));
}
