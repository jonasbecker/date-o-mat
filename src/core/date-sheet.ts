// "date steht." – the date card as a sheet you pull up, the flower gets pushed (docs/design/garten/date-steht/
// DATE-STEHT.md). Pure geometry: the reference is 390 × 844; here everything is relative to the Beet's area
// (the reference's x 20 / y 60 is our 0 / 0), so it also works on other phone sizes.

/** Where the flower's 300 × 420 box sits: translate(x, y) scale(s) rotate(r) with the origin top left. */
export type Pose = { x: number; y: number; s: number; r: number };
export type Tempo = "sanft" | "schubs";
export type BubbleBox = { x: number; y: number; w: number; fontSize: number; rotate: number };

export const SHEET = {
  /** Height of the closed card; its bottom edge stays put, only its top moves. */
  closedHeight: 192,
  /** Top of the open card (reference 236). */
  openTop: 176,
  /** The card reaches this far below the Beet's area (into the space above the tab bar). */
  overhang: 20,
  /** Gap between the closed card and the flower's pot. */
  potGap: 7,
  /** Past this share of the way the card opens (or, pulled down from open, closes). */
  threshold: 0.35,
  /** Faster than this (px/ms) is a "schubs". */
  flick: 0.8,
} as const;

export const TIMING: Record<Tempo, { ms: number; ease: string; cardEase: string }> = {
  sanft: { ms: 900, ease: "cubic-bezier(0.4, 0, 0.2, 1)", cardEase: "cubic-bezier(0.4, 0, 0.2, 1)" },
  schubs: { ms: 650, ease: "cubic-bezier(0.2, 1.7, 0.4, 1)", cardEase: "cubic-bezier(0.25, 1.2, 0.4, 1)" },
};

/** Reference sizes: the flower is drawn at 0.72 when closed (216 × 302). */
const ZU_SCALE = 0.72;
const REF_WIDTH = 350;

export type SheetLayout = {
  cardTopZu: number;
  cardTopOpen: number;
  zu: Pose;
  mitte: Record<Tempo, Pose>;
  offen: Record<Tempo, Pose>;
  bubbleZu: BubbleBox;
  bubbleOffen: Record<Tempo, BubbleBox>;
  /** The three motion lines of a kick, around where the flower stood. */
  lines: Array<{ x: number; y: number; w: number }>;
};

/**
 * The layout for an area of `width` × `height`; `flowBottom` is where the text above the flower ends
 * (headline, week, subtitle) – on a short phone the closed flower gets smaller instead of covering it.
 * `headerTop`: where the page's header starts (above the area, so negative) – the open bubble sits in it,
 * between the name and the avatars (reference: 10 px above it).
 */
export function sheetLayout({ width, height, flowBottom, headerTop = -42 }: { width: number; height: number; flowBottom: number; headerTop?: number }): SheetLayout {
  const bottom = height + SHEET.overhang;
  const cardTopZu = bottom - SHEET.closedHeight;
  const cardTopOpen = Math.min(SHEET.openTop, cardTopZu - 40);
  // Room for the closed flower between the text and the card (302 px in the reference).
  const room = cardTopZu - SHEET.potGap - (flowBottom + 2);
  const k = Math.max(0.5, Math.min(1, room / (420 * ZU_SCALE)));
  const s = ZU_SCALE * k;
  const zu: Pose = { x: Math.round((width - 300 * s) / 2 - 5 * k), y: Math.round(cardTopZu - SHEET.potGap - 420 * s), s, r: 0 };
  // Open, the head sits right of the headline, under the avatars (reference ≈ 310, 88).
  const right = width - REF_WIDTH;
  return {
    cardTopZu,
    cardTopOpen,
    zu,
    mitte: {
      sanft: { x: zu.x + 60 * k, y: zu.y - 60 * k, s: s * 0.8, r: 8 },
      schubs: { x: zu.x + 120 * k, y: zu.y - 150 * k, s: s * 0.62, r: -38 },
    },
    offen: {
      sanft: { x: 242 + right, y: -8, s: ZU_SCALE * 0.444, r: 0 },
      schubs: { x: 235 + right, y: 5, s: ZU_SCALE * 0.444, r: -14 },
    },
    // Right of the head – never above where the text ends.
    bubbleZu: { x: Math.min(zu.x + 184 * k, width + 6 - 110), y: Math.max(zu.y + 5 * k, flowBottom + 6), w: 110, fontSize: 20, rotate: -3 },
    // Between the name and the avatars of the header.
    bubbleOffen: {
      sanft: { x: 92, y: headerTop - 10, w: Math.min(150, width - 147), fontSize: 17, rotate: -2 },
      schubs: { x: 92, y: headerTop - 10, w: Math.min(150, width - 147), fontSize: 17, rotate: 2 },
    },
    lines: [
      { x: zu.x + 14 * k, y: zu.y + 67 * k, w: 60 },
      { x: zu.x + 38 * k, y: zu.y + 97 * k, w: 44 },
      { x: zu.x + 68 * k, y: zu.y + 121 * k, w: 54 },
    ],
  };
}

/** How far the card is open (0 = zu, 1 = offen) for a card top. */
export function progress(top: number, layout: Pick<SheetLayout, "cardTopZu" | "cardTopOpen">): number {
  return Math.max(0, Math.min(1, (layout.cardTopZu - top) / (layout.cardTopZu - layout.cardTopOpen)));
}

const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export function mixPose(a: Pose, b: Pose, p: number): Pose {
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), s: mix(a.s, b.s, p), r: mix(a.r, b.r, p) };
}

export function mixBubble(a: BubbleBox, b: BubbleBox, p: number): BubbleBox {
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), w: mix(a.w, b.w, p), fontSize: mix(a.fontSize, b.fontSize, p), rotate: mix(a.rotate, b.rotate, p) };
}

export function poseTransform(p: Pose): string {
  return `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${p.s.toFixed(4)}) rotate(${p.r.toFixed(1)}deg)`;
}

/** A point of the flower's 300 × 420 box where the pose puts it. */
function place(pose: Pose, bx: number, by: number) {
  const a = (pose.r * Math.PI) / 180;
  const x = bx * pose.s;
  const y = by * pose.s;
  return { x: pose.x + x * Math.cos(a) - y * Math.sin(a), y: pose.y + x * Math.sin(a) + y * Math.cos(a) };
}

/** The head's center and its reach (petals included) in the box. */
const HEAD = { x: 150, y: 112, reach: 66 };

/**
 * The two dots of the thought bubble (top left of each): the small one (6 px) just outside the petals
 * towards the bubble, the big one (10 px) halfway from there to the bubble's nearest corner.
 */
export function bubbleDots(pose: Pose, bubble: { x: number; y: number; w: number; h: number }) {
  const head = place(pose, HEAD.x, HEAD.y);
  const corners = [
    { x: bubble.x, y: bubble.y },
    { x: bubble.x + bubble.w, y: bubble.y },
    { x: bubble.x, y: bubble.y + bubble.h },
    { x: bubble.x + bubble.w, y: bubble.y + bubble.h },
  ];
  const corner = corners.reduce((best, c) => (Math.hypot(c.x - head.x, c.y - head.y) < Math.hypot(best.x - head.x, best.y - head.y) ? c : best));
  const dist = Math.hypot(corner.x - head.x, corner.y - head.y) || 1;
  const dir = { x: (corner.x - head.x) / dist, y: (corner.y - head.y) / dist };
  const reach = HEAD.reach * pose.s + 5;
  const small = { x: head.x + dir.x * reach, y: head.y + dir.y * reach };
  const big = { x: (small.x + corner.x) / 2, y: (small.y + corner.y) / 2 };
  return { small: { x: small.x - 3, y: small.y - 3 }, big: { x: big.x - 5, y: big.y - 5 } };
}

/**
 * Letting go: open past 35 % of the way (from closed) or closed past 35 % back (from open);
 * faster than 0.8 px/ms is a "schubs".
 */
export function release(p: number, startedOpen: boolean, speed: number): { open: boolean; tempo: Tempo } {
  const open = startedOpen ? p > 1 - SHEET.threshold : p > SHEET.threshold;
  return { open, tempo: Math.abs(speed) > SHEET.flick ? "schubs" : "sanft" };
}
