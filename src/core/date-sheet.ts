// "date steht." – the date card as a sheet you pull up, the flower gets pushed (docs/design/garten/date-steht/
// DATE-STEHT.md). Pure geometry: the reference is 390 × 844; here everything is relative to the Beet's area
// (the reference's x 20 / y 60 is our 0 / 0), so it also works on other phone sizes.
//
// Three stops: "zu" (only the title and when · where), "mitte" (the reference's open card, the flower pushed
// up next to the headline) and "voll" (the card covers the screen, its handle becomes the header's step bar,
// the flower has flown off the top). Between them everything follows the card's top – while the finger moves it
// and while it springs to a stop – so the flower, the bubble and the handle are always in time with the card.

/** Where the flower's 300 × 420 box sits: translate(x, y) scale(s) rotate(r) with the origin top left. */
export type Pose = { x: number; y: number; s: number; r: number };
export type Tempo = "sanft" | "schubs";
export type Stop = "zu" | "mitte" | "voll";
export type BubbleBox = { x: number; y: number; w: number; fontSize: number; rotate: number };
/** The little bar on top of the card (inside the card: top, width, height). */
export type Handle = { top: number; w: number; h: number };

export const STOPS: Stop[] = ["zu", "mitte", "voll"];

export const SHEET = {
  /** Space around the closed card's text: handle row above (24), padding below. */
  headPadding: 44,
  /** Top of the card at "mitte" (reference 236). */
  midTop: 176,
  /** The card reaches this far below the Beet's area (into the space above the tab bar) – at voll down to the bar. */
  overhang: 20,
  overhangVoll: 28,
  /** Gap between the closed card and the flower's pot. */
  potGap: 7,
  /** Faster than this (px/ms) is a "schubs" – and always goes one stop further. */
  flick: 0.8,
  /** Letting go, the card counts as where it would be this much later (ms) at the finger's speed. */
  project: 150,
  /** Pulled down below zu the card gives way less and less, at most this far (px). */
  stretch: 40,
  /** The card's sides: a little wider than the text at zu / mitte, edge to edge at voll. */
  insetZu: 8,
  insetVoll: 20,
  radius: 26,
} as const;

/**
 * The spring the card settles with (`response`: seconds per swing, `damping`: 1 = no overshoot). Sanft lands
 * softly, a schubs swings a little past and back – the flower, bubble and handle follow the card, so they swing too.
 */
export const SPRING: Record<Tempo, { response: number; damping: number }> = {
  sanft: { response: 0.42, damping: 0.86 },
  schubs: { response: 0.46, damping: 0.66 },
};

/** Reference sizes: the flower is drawn at 0.72 when closed (216 × 302) – it grows or shrinks with the room it has. */
const ZU_SCALE = 0.72;
const REF_WIDTH = 350;
const HANDLE: Handle = { top: 8, w: 38, h: 4 };

export type SheetLayout = {
  /** The Beet's area. */
  width: number;
  height: number;
  /** The closed card's text (measured). */
  headH: number;
  /** The card's top at each stop. */
  tops: Record<Stop, number>;
  zu: Pose;
  mitte: Pose;
  /** Above the screen. */
  voll: Pose;
  bubbleZu: BubbleBox;
  bubbleMitte: BubbleBox;
  /** The handle at zu / mitte, and at voll (where the header's step bar is). */
  handle: Handle;
  handleVoll: Handle;
  /** The header's step bar (its middle and size): the bubble at mitte grows out of it. */
  bar: { x: number; y: number; w: number; h: number };
  /** Padding above the card's text: below the handle, at voll below the header. */
  padTop: Record<"zu" | "voll", number>;
  /** The three motion lines of a kick, around where the flower stood. */
  lines: Array<{ x: number; y: number; w: number }>;
};

/**
 * The layout for an area of `width` × `height`; `flowBottom` is where the text above the flower ends
 * (headline, week, subtitle) – on a short phone the closed flower gets smaller instead of covering it.
 * `headH`: the closed card's text (title, when · where) – the closed card is just as high as that needs.
 * `headerTop` / `headerBottom`: the page's header (above the area, so negative) – the bubble at mitte sits in
 * it, between the name and the avatars (reference: 10 px above it). `screenTop`: the top of the screen (the
 * card's top at voll). `bar`: the middle of the header's step bar and its size – the handle ends up there.
 */
export function sheetLayout({
  width,
  height,
  flowBottom,
  headH = 80,
  headerTop = -42,
  headerBottom = headerTop + 44,
  screenTop = headerTop - 16,
  bar: barIn,
}: {
  width: number;
  height: number;
  flowBottom: number;
  headH?: number;
  headerTop?: number;
  headerBottom?: number;
  screenTop?: number;
  bar?: { x?: number; y: number; w: number; h: number };
}): SheetLayout {
  const bar = { x: barIn?.x ?? width / 2, y: barIn?.y ?? headerTop + 22, w: barIn?.w ?? 58, h: barIn?.h ?? 6 };
  const bottom = height + SHEET.overhang;
  const zuTop = Math.round(bottom - (headH + SHEET.headPadding));
  const midTop = Math.min(SHEET.midTop, zuTop - 40);
  // Room for the closed flower between the text and the card (302 px in the reference).
  const room = zuTop - SHEET.potGap - (flowBottom + 2);
  // The closed flower fills that room (on a tall phone bigger than the reference) – only as wide as the area.
  const k = Math.max(0.3, Math.min(room / (420 * ZU_SCALE), width / (300 * ZU_SCALE)));
  const s = ZU_SCALE * k;
  const zu: Pose = { x: Math.round((width - 300 * s) / 2 - 5 * k), y: Math.round(zuTop - SHEET.potGap - 420 * s), s, r: 0 };
  // At mitte the head sits right of the headline, under the avatars (reference ≈ 310, 88).
  const right = width - REF_WIDTH;
  const mitte: Pose = { x: 242 + right, y: -8, s: ZU_SCALE * 0.444, r: 0 };
  const bubbleW = Math.min(150, width - 147);
  return {
    width,
    height,
    headH,
    tops: { zu: zuTop, mitte: midTop, voll: screenTop },
    zu,
    mitte,
    // Off the top, a little to the right and tumbling.
    voll: { x: mitte.x + 40, y: screenTop - 420 * mitte.s - 40, s: mitte.s, r: -28 },
    // Right of the head – never above where the text ends.
    bubbleZu: { x: Math.min(zu.x + 184 * k, width + 6 - 110), y: Math.max(zu.y + 5 * k, flowBottom + 6), w: 110, fontSize: 20, rotate: -3 },
    // Between the name and the avatars of the header.
    bubbleMitte: { x: 92, y: headerTop - 10, w: bubbleW, fontSize: 17, rotate: -2 },
    handle: HANDLE,
    handleVoll: { top: Math.round(bar.y - bar.h / 2 - screenTop), w: bar.w, h: bar.h },
    bar,
    padTop: { zu: 24, voll: Math.round(headerBottom - screenTop + 14) },
    lines: [
      { x: zu.x + 14 * k, y: zu.y + 67 * k, w: 60 },
      { x: zu.x + 38 * k, y: zu.y + 97 * k, w: 44 },
      { x: zu.x + 68 * k, y: zu.y + 121 * k, w: 54 },
    ],
  };
}

/** Where the card is: 0 = zu, 1 = mitte, 2 = voll, in between while it moves. */
export function position(top: number, layout: Pick<SheetLayout, "tops">): number {
  const { zu, mitte, voll } = layout.tops;
  if (top >= mitte) return Math.max(0, Math.min(1, (zu - top) / (zu - mitte)));
  return Math.min(2, 1 + (mitte - top) / (mitte - voll));
}

/** The card's top for a position (the inverse of `position`). */
export function topAt(pos: number, layout: Pick<SheetLayout, "tops">): number {
  const { zu, mitte, voll } = layout.tops;
  return pos <= 1 ? mix(zu, mitte, Math.max(0, pos)) : mix(mitte, voll, Math.min(1, pos - 1));
}

const mix = (a: number, b: number, p: number) => a + (b - a) * p;

export function mixPose(a: Pose, b: Pose, p: number): Pose {
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), s: mix(a.s, b.s, p), r: mix(a.r, b.r, p) };
}

export function mixBubble(a: BubbleBox, b: BubbleBox, p: number): BubbleBox {
  return { x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), w: mix(a.w, b.w, p), fontSize: mix(a.fontSize, b.fontSize, p), rotate: mix(a.rotate, b.rotate, p) };
}

/** The flower at a position: pushed up towards mitte, then flying off the top (and back down, the same way). */
export function poseAt(pos: number, layout: SheetLayout): Pose {
  return pos <= 1 ? mixPose(layout.zu, layout.mitte, Math.max(0, pos)) : mixPose(layout.mitte, layout.voll, Math.min(1, pos - 1));
}

/**
 * The bubble at mitte grows out of the header's step bar: 0 = the bar, 1 = the bubble. On the way from zu to
 * mitte it grows, from mitte to voll it shrinks back into the bar (where the card's handle arrives) and goes.
 */
export function morphAt(pos: number): { grow: number; opacity: number } {
  if (pos <= 1) return { grow: Math.max(0, pos), opacity: pos > 0 ? 1 : 0 };
  return { grow: Math.max(0, 2 - pos), opacity: Math.min(1, Math.max(0, (2 - pos) / 0.25)) };
}

/** The bubble's transform for `grow` (its box at mitte, `h` its height) – from the bar's place and size to its own. */
export function morphTransform(box: BubbleBox, h: number, bar: SheetLayout["bar"], grow: number): string {
  const g = Math.max(0, Math.min(1, grow));
  const cx = box.x + box.w / 2;
  const cy = box.y + h / 2;
  const x = box.x + (bar.x - cx) * (1 - g);
  const y = box.y + (bar.y - cy) * (1 - g);
  const sx = mix(bar.w / box.w, 1, g);
  const sy = mix(bar.h / Math.max(1, h), 1, g);
  return `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${(box.rotate * g).toFixed(1)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
}

/** The bubble at a position, and how visible it is (it fades on the way to voll – no flower, no words). */
export function bubbleAt(pos: number, layout: SheetLayout): { box: BubbleBox; opacity: number } {
  if (pos <= 1) return { box: mixBubble(layout.bubbleZu, layout.bubbleMitte, Math.max(0, pos)), opacity: 1 };
  return { box: layout.bubbleMitte, opacity: Math.max(0, 1 - (pos - 1) * 2.5) };
}

/**
 * The card's look at a position: from mitte to voll it widens to the edges, loses its corners, reaches down to
 * the tab bar, and the handle grows into the step bar.
 */
export function cardAt(pos: number, layout: SheetLayout): { inset: number; radius: number; bottom: number; padTop: number; handle: Handle } {
  const q = Math.max(0, Math.min(1, pos - 1));
  const h = layout.handle;
  const v = layout.handleVoll;
  return {
    inset: mix(SHEET.insetZu, SHEET.insetVoll, q),
    radius: mix(SHEET.radius, 0, q),
    bottom: mix(SHEET.overhang, SHEET.overhangVoll, q),
    padTop: mix(layout.padTop.zu, layout.padTop.voll, q),
    handle: { top: mix(h.top, v.top, q), w: mix(h.w, v.w, q), h: mix(h.h, v.h, q) },
  };
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
 * Letting go at `top` with the finger's `speed` (px/ms, upwards positive): the card goes to the stop nearest to
 * where it would be a moment later. Faster than 0.8 px/ms is a "schubs", which goes to the next stop in the
 * direction of the flick (from just before a stop: the one after it).
 */
export function release(top: number, speed: number, layout: Pick<SheetLayout, "tops">): { to: Stop; tempo: Tempo } {
  const pos = position(top, layout);
  if (Math.abs(speed) > SHEET.flick) {
    const next = speed > 0 ? Math.ceil(pos + 0.05) : Math.floor(pos - 0.05);
    return { to: STOPS[Math.max(0, Math.min(STOPS.length - 1, next))], tempo: "schubs" };
  }
  return { to: nearest(position(top - speed * SHEET.project, layout)), tempo: "sanft" };
}

/** The stop closest to a position. */
export function nearest(pos: number): Stop {
  return STOPS[Math.max(0, Math.min(STOPS.length - 1, Math.round(pos)))];
}

/** Where the finger puts the card: right under it, only below zu it gives way less and less (and never above voll). */
export function follow(top: number, layout: Pick<SheetLayout, "tops">): number {
  const { zu, voll } = layout.tops;
  if (top <= zu) return Math.max(voll, top);
  return zu + SHEET.stretch * (1 - Math.exp(-(top - zu) / SHEET.stretch));
}

/**
 * One step of the card's spring towards `target` (`dt` in ms, `v` in px/ms): it starts at the speed the finger
 * had – no jolt when letting go – and takes as long as its way needs.
 */
export function springStep(top: number, v: number, target: number, dt: number, tempo: Tempo): { top: number; v: number } {
  const { response, damping } = SPRING[tempo];
  const w = (2 * Math.PI) / (response * 1000);
  // Small steps keep it stable on a slow frame.
  const steps = Math.max(1, Math.ceil(dt / 4));
  const h = dt / steps;
  let x = top;
  let u = v;
  for (let i = 0; i < steps; i++) {
    u += (-w * w * (x - target) - 2 * damping * w * u) * h;
    x += u * h;
  }
  return { top: x, v: u };
}

/** At rest: closer than half a pixel and slower than a pixel per second. */
export function atRest(top: number, v: number, target: number): boolean {
  return Math.abs(top - target) < 0.5 && Math.abs(v) < 0.001;
}

/**
 * The flower leans with the card's speed (`v` px/ms, downwards positive), around the bottom of its pot: pushed up
 * it tips back, when the card stops it swings upright again – always in time with the card. Degrees.
 */
export function leanFor(v: number): number {
  return Math.max(-14, Math.min(14, v * 9));
}

/** The pot's bottom in the flower's 300 × 420 box: it leans around it. */
const POT = { x: 150, y: 410 };

/** The pose with a lean around the pot (as one pose, so the bubble's dots know where the head is). */
export function leaned(pose: Pose, lean: number): Pose {
  if (lean === 0) return pose;
  const pot = place(pose, POT.x, POT.y);
  const turned = { ...pose, x: 0, y: 0, r: pose.r + lean };
  const off = place(turned, POT.x, POT.y);
  return { x: pot.x - off.x, y: pot.y - off.y, s: pose.s, r: pose.r + lean };
}
