// The flower on the Beet (docs/design/main-b/MAIN-B-UND-BLUME.md §3): a pot without a face, a stem with
// up to five leaves (your dates), and a head whose face shows the mood of the round.
// Pure geometry in a 300×420 box – ported 1:1 from renderVals() in components/Bloom.html;
// the drawing is components/bloom.tsx.

export type Stimmung = "schlaeft" | "wartet" | "froh" | "blueht" | "traurig" | "genervt" | "autsch";
/** The moods of a round (§3). `genervt` / `autsch` are only for the date sheet (date-steht/DATE-STEHT.md §4). */
export const STIMMUNGEN: readonly Stimmung[] = ["schlaeft", "wartet", "froh", "blueht", "traurig", "genervt", "autsch"];

export const BLOOM_BOX = { width: 300, height: 420 } as const;
/** Leaves on the flower; older dates are in the Archiv. */
export const MAX_BLOOM_LEAVES = 5;

export const STIMMUNG_LABEL: Record<Stimmung, string> = {
  schlaeft: "Blume schläft",
  wartet: "Blume wartet",
  froh: "Blume freut sich",
  blueht: "Blume blüht",
  traurig: "Blume ist traurig",
  genervt: "Blume ist genervt",
  autsch: "Blume sagt autsch",
};

const PETALS: Record<Stimmung, { count: number; d: number; dist: number; face: number }> = {
  schlaeft: { count: 0, d: 0, dist: 0, face: 40 },
  wartet: { count: 8, d: 32, dist: 38, face: 60 },
  froh: { count: 8, d: 42, dist: 44, face: 66 },
  blueht: { count: 10, d: 44, dist: 52, face: 70 },
  traurig: { count: 6, d: 34, dist: 38, face: 60 },
  genervt: { count: 8, d: 40, dist: 42, face: 64 },
  autsch: { count: 8, d: 40, dist: 43, face: 64 },
};

export type BloomLeaf = {
  /** The box of the ellipse (like the mockup's divs) and its rotation around `origin`. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  originX: number;
  originY: number;
  dead: boolean;
  light: boolean;
};

export type Petal = { x: number; y: number; d: number; light: boolean };

export type BloomGeometry = {
  stem: string;
  leaves: BloomLeaf[];
  /** Petals relative to the head center (the box of each circle). */
  petals: Petal[];
  head: { x: number; y: number; rotate: number };
  face: { d: number; sad: boolean; visible: boolean };
  eyes: "dot" | "happy" | "closed" | "x" | "flat";
  /** x of the left/right dot eye (its box), relative to the head. */
  eyeL: number;
  eyeR: number;
  brows: boolean;
  tear: boolean;
  blush: boolean;
  mouth: "smile" | "big" | "frown" | "o" | "flat" | "ouch";
  bud: boolean;
  sparkles: Array<{ x: number; y: number; d: number }>;
  zzz: boolean;
  fallen: boolean;
};

export function bloomGeometry(stimmung: Stimmung, blaetter: number, welk = -1): BloomGeometry {
  const st = stimmung;
  const n = Math.max(0, Math.min(MAX_BLOOM_LEAVES, Math.round(blaetter)));
  const sad = st === "traurig";
  const P = PETALS[st];
  const petals: Petal[] = [];
  for (let k = 0; k < P.count; k++) {
    // Kicked away: two petals are gone.
    if (st === "autsch" && (k === 1 || k === 4)) continue;
    const a = (k / P.count) * Math.PI * 2 - Math.PI / 2 + (sad ? 0.4 : 0);
    petals.push({ x: Math.round(Math.cos(a) * P.dist - P.d / 2), y: Math.round(Math.sin(a) * P.dist - P.d / 2), d: P.d, light: k % 2 === 1 });
  }
  const hx = sad ? 182 : 150;
  const hy = sad ? 148 : 112;
  const leaves: BloomLeaf[] = Array.from({ length: n }, (_, i) => {
    const right = i % 2 === 0;
    const w = 56 - i * 4;
    const h = Math.round(w * 0.5);
    const y = 318 - i * 26;
    const dead = i === welk;
    let rotate = right ? -30 : 30;
    if (sad) rotate = right ? 8 : -8;
    if (dead) rotate = right ? 40 : -40;
    const x = right ? 153 : 147 - w;
    return { x, y: y - h / 2, w, h, rotate, originX: right ? x : x + w, originY: y, dead, light: i % 2 === 1 };
  });
  return {
    stem: sad ? "M150 336 C150 260, 150 200, 182 148" : `M150 336 L150 ${hy}`,
    leaves,
    petals,
    head: { x: hx, y: hy, rotate: sad ? 24 : st === "autsch" ? -18 : st === "genervt" ? 8 : 0 },
    face: { d: P.face, sad, visible: st !== "schlaeft" },
    eyes: st === "froh" || st === "blueht" ? "happy" : st === "schlaeft" ? "closed" : st === "autsch" ? "x" : st === "genervt" ? "flat" : "dot",
    eyeL: st === "wartet" ? -10 : -14,
    eyeR: st === "wartet" ? 10 : 6,
    brows: sad,
    tear: sad,
    blush: st === "froh" || st === "blueht",
    mouth: st === "froh" ? "smile" : st === "blueht" ? "big" : sad ? "frown" : st === "genervt" ? "flat" : st === "autsch" ? "ouch" : "o",
    bud: st === "schlaeft",
    sparkles:
      st === "blueht"
        ? [
            { x: 60, y: 50, d: 10 },
            { x: 232, y: 70, d: 8 },
            { x: 220, y: 170, d: 12 },
            { x: 74, y: 160, d: 7 },
          ]
        : st === "autsch"
          ? [
              { x: 70, y: 40, d: 14 },
              { x: 214, y: 28, d: 12 },
              { x: 236, y: 120, d: 10 },
              { x: 52, y: 128, d: 9 },
            ]
          : [],
    zzz: st === "schlaeft",
    fallen: sad,
  };
}

/**
 * The leaves of the flower from the rounds (oldest first): the last five lived or skipped rounds,
 * `welk` = the position of the latest skipped one among them (−1 = none).
 */
export function bloomLeaves(rounds: readonly ("done" | "skipped")[]): { blaetter: number; welk: number } {
  const last = rounds.slice(-MAX_BLOOM_LEAVES);
  return { blaetter: last.length, welk: last.lastIndexOf("skipped") };
}

export type BloomRound =
  /** Nothing planned yet (whoever is on). */
  | "offen"
  /** An invitation is out, the other one has to answer. */
  | "eingeladen"
  /** Both said yes, the date lies ahead. */
  | "bestaetigt"
  /** The date was lived. */
  | "erlebt"
  /** The round ran out without a date. */
  | "ausgefallen";

/**
 * The mood (§3): lived within the last day → blüht; confirmed → froh; invitation out → wartet;
 * a missed round to make up or less than 12 h left → traurig; otherwise it sleeps.
 */
export function bloomStimmung(input: { round: BloomRound; livedHoursAgo?: number | null; lastRoundSkipped: boolean; hoursLeft?: number | null }): Stimmung {
  const { round } = input;
  if (round === "erlebt" && input.livedHoursAgo != null && input.livedHoursAgo < 24) return "blueht";
  if (round === "bestaetigt") return "froh";
  if (round === "eingeladen") return "wartet";
  if (round === "ausgefallen") return "traurig";
  if (round === "offen" && (input.lastRoundSkipped || (input.hoursLeft != null && input.hoursLeft < 12))) return "traurig";
  return "schlaeft";
}

const SAYINGS: Record<Stimmung, readonly string[]> = {
  schlaeft: ["neue woche, neues glück. wer gießt?", "noch alles still hier … zeit für ein date?", "ich träum schon von eurem nächsten date."],
  wartet: ["{partner} guckt grad … daumen drücken.", "pssst, ich warte auf {partner}.", "gleich weiß {partner} bescheid!"],
  froh: ["juhu, wasser! {day} wird schön.", "ich freu mich schon auf {day}!", "date steht. ich grins schon."],
  blueht: ["schaut mal, ein neues blatt!", "das war schön. ich blühe!", "danke fürs gießen!"],
  traurig: ["psst … letztes mal fiel's aus. heute vielleicht?", "ich hab durst … nur noch kurz zeit.", "nicht vergessen: die frist läuft ab."],
  // The date sheet pushed it up gently (sanft) or kicked it away (schubs) – DATE-STEHT.md §5.
  genervt: ["hey … ich rück ja schon.", "drängeln ist auch eine sprache.", "na gut. ich wart hier oben.", "ich hab hier oben eh die bessere aussicht."],
  autsch: ["WAAAH—!", "AUA! mein lieblingsblatt.", "ich bin eine PFLANZE, kein ball!", "das sag ich {partner}."],
};

/**
 * What the flower says in its thought bubble – fits the mood and changes now and then (`seed`, e.g. the day).
 * `turn`: whose move it is – the flower never asks "wer gießt?" when it knows.
 */
export function bloomSaying(stimmung: Stimmung, seed: number, words: { partner: string; day?: string; missed?: boolean; turn?: "me" | "partner" }): string {
  const options = SAYINGS[stimmung].map((o) =>
    o.endsWith("wer gießt?") && words.turn ? o.replace("wer gießt?", words.turn === "me" ? "du gießt!" : "{partner} gießt.") : o,
  );
  // Sad because the last round was missed: that's what it talks about; with time running out the others.
  const pick = stimmung === "traurig" ? (words.missed ? 0 : 1 + (Math.abs(seed) % (options.length - 1))) : Math.abs(seed) % options.length;
  return options[pick].replaceAll("{partner}", words.partner.toLowerCase()).replaceAll("{day}", (words.day ?? "bald").toLowerCase());
}

/** The pots of the flower (Setup, DESIGN-GARTEN.md §5.5): a small reward for the streak. */
export { FLOWER_POTS, type FlowerPot } from "@/lib/domain";
import { FLOWER_POTS, type FlowerPot } from "@/lib/domain";
export const POT_UNLOCK: Record<FlowerPot, number> = { terrakotta: 0, blau: 10, gelb: 25 };
export const POT_COLORS: Record<FlowerPot, { body: string; rim: string }> = {
  terrakotta: { body: "#D68456", rim: "#C26A3F" },
  blau: { body: "#6A8FC7", rim: "#5578AE" },
  gelb: { body: "#E8C35A", rim: "#CFA941" },
};
export const POT_LABEL: Record<FlowerPot, string> = { terrakotta: "Terrakotta", blau: "Blau", gelb: "Gelb" };

/** Which pots you have after so many lived dates. */
export function unlockedPots(livedDates: number): FlowerPot[] {
  return FLOWER_POTS.filter((p) => livedDates >= POT_UNLOCK[p]);
}

/** The pot to draw: the chosen one if it is unlocked, else terracotta. */
export function shownPot(chosen: string | null | undefined, livedDates: number): FlowerPot {
  return FLOWER_POTS.includes(chosen as FlowerPot) && livedDates >= POT_UNLOCK[chosen as FlowerPot] ? (chosen as FlowerPot) : "terrakotta";
}
