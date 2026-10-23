// The Archiv "unser beet." (docs/design/garten/archiv/ARCHIV.md): every date a leaf, every round that fell through a
// wilted one, newest on top. Here: the leaves with their number, month and chip, the stem's geometry (Archiv.html's
// renderVals 1:1) and the grid's month groups. Pure.
import { DateTime } from "luxon";
import { APP_TIMEZONE, type AgainAnswer } from "@/lib/domain";
import { visibleReviews } from "./reviews";

export type ArchiveDateIn = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  plannerId: string | null;
  location: string | null;
  costEur: number | null;
  reviews: { userId: string; rating: number | null; note: string | null; again: AgainAnswer | null }[];
  photoIds: string[];
  motif: string;
};
export type ArchiveWiltIn = { id: string; startsAt: Date; plannerId: string | null; title: string | null; plannedAt: Date | null };

/** The last view chosen (Stiel | Raster) – a cookie, so the server renders it right away. */
export const ARCHIVE_VIEW_COOKIE = "dom-archiv";
export type ArchiveView = "stiel" | "raster";

export type ChipTone = "both" | "plain" | "wilt";
export type Leaf = {
  kind: "date" | "wilt";
  id: string;
  /** Nº – the how-manyth leaf on the stem (oldest = 1). */
  nr: number;
  title: string;
  /** "2026-10" and "OKTOBER". */
  month: string;
  monthLabel: string;
  /** "Do 22.10." – a wilted one: "Woche 41". */
  day: string;
  plannerId: string | null;
  chip: { text: string; tone: ChipTone };
  /** Both said "unbedingt". */
  both: boolean;
  photoIds: string[];
  motif: string | null;
  href: string;
  at: Date;
};

/** "♥ nochmal: beide" / "einmal reicht" / "nochmal: vielleicht" – what this viewer may see (the other one's answer after their own). */
export function againChip(reviews: ArchiveDateIn["reviews"], viewerId: string): { text: string; tone: ChipTone; both: boolean } {
  const { mine, partner } = visibleReviews(reviews, viewerId);
  const answers = [mine?.again, partner?.again];
  if (answers.every((a) => a === "yes")) return { text: "♥ nochmal: beide", tone: "both", both: true };
  if (answers.includes("no")) return { text: "einmal reicht", tone: "plain", both: false };
  return { text: "nochmal: vielleicht", tone: "plain", both: false };
}

export function dayLabel(at: Date, zone = APP_TIMEZONE): string {
  const d = DateTime.fromJSDate(at, { zone }).setLocale("de");
  return `${d.toFormat("ccc").replace(".", "")} ${d.toFormat("dd.LL.")}`;
}

function month(at: Date, zone: string): { key: string; label: string } {
  const d = DateTime.fromJSDate(at, { zone }).setLocale("de");
  return { key: d.toFormat("yyyy-LL"), label: d.toFormat("LLLL").toLocaleUpperCase("de-DE") };
}

/** All leaves, newest first; Nº counts from the oldest. */
export function archiveLeaves(dates: ArchiveDateIn[], wilts: ArchiveWiltIn[], viewerId: string, zone = APP_TIMEZONE): Leaf[] {
  const all = [
    ...dates.map((d) => {
      const chip = againChip(d.reviews, viewerId);
      const m = month(d.startsAt, zone);
      return {
        kind: "date" as const,
        id: d.id,
        title: d.title,
        month: m.key,
        monthLabel: m.label,
        day: dayLabel(d.startsAt, zone),
        plannerId: d.plannerId,
        chip: { text: chip.text, tone: chip.tone },
        both: chip.both,
        photoIds: d.photoIds,
        motif: d.motif,
        href: `/dates/${d.id}`,
        at: d.startsAt,
      };
    }),
    ...wilts.map((w) => {
      const at = w.plannedAt ?? w.startsAt;
      const m = month(at, zone);
      return {
        kind: "wilt" as const,
        id: w.id,
        title: w.title ?? "Runde ohne Date",
        month: m.key,
        monthLabel: m.label,
        day: `Woche ${DateTime.fromJSDate(at, { zone }).weekNumber}`,
        plannerId: w.plannerId,
        chip: { text: "ausgefallen", tone: "wilt" as const },
        both: false,
        photoIds: [],
        motif: null,
        href: `/dates/runde/${w.id}`,
        at,
      };
    }),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return all.map((leaf, i) => ({ ...leaf, nr: i + 1 })).reverse();
}

// --- The stem (Archiv.html renderVals) ------------------------------------------------------------

export const LEAF = { photo: 150, wilt: 96, gap: 26, afterMark: 38 } as const;

export type StemItem = { leaf: Leaf; top: number; height: number; side: "left" | "right" };
export type StemMark = { top: number; label: string };

/** Where each leaf and month mark sits, from the first month mark at 0 down; leaves alternate left and right. */
export function stemLayout(leaves: Leaf[]): { marks: StemMark[]; items: StemItem[]; height: number } {
  let y = 0;
  let last = "";
  const marks: StemMark[] = [];
  const items: StemItem[] = [];
  leaves.forEach((leaf, k) => {
    if (leaf.month !== last) {
      marks.push({ top: y, label: leaf.monthLabel });
      y += LEAF.afterMark;
      last = leaf.month;
    }
    const height = leaf.kind === "wilt" ? LEAF.wilt : LEAF.photo;
    items.push({ leaf, top: y, height, side: k % 2 === 0 ? "left" : "right" });
    y += height + LEAF.gap;
  });
  return { marks, items, height: Math.max(0, y - LEAF.gap) };
}

/** The grid: months, newest first, with "1 Blatt" / "4 Blätter". */
export function monthGroups(leaves: Leaf[]): { month: string; label: string; count: string; leaves: Leaf[] }[] {
  const groups: { month: string; label: string; count: string; leaves: Leaf[] }[] = [];
  for (const leaf of leaves) {
    let g = groups.find((x) => x.month === leaf.month);
    if (!g) {
      g = { month: leaf.month, label: leaf.monthLabel, count: "", leaves: [] };
      groups.push(g);
    }
    g.leaves.push(leaf);
  }
  for (const g of groups) g.count = g.leaves.length === 1 ? "1 Blatt" : `${g.leaves.length} Blätter`;
  return groups;
}

// --- "wie war's?" (ARCHIV.md §3) ------------------------------------------------------------------

export type AgainChoice = AgainAnswer | null;

/** How the flower takes the answer: its mood, a wilted leaf for "nö", and what it says. */
export function againReaction(again: AgainChoice): { mood: "wartet" | "traurig" | "froh" | "blueht"; welk: number; quip: string } {
  switch (again) {
    case "no":
      return { mood: "traurig", welk: 1, quip: "okay. kompost. passiert den besten." };
    case "maybe":
      return { mood: "froh", welk: -1, quip: "solide. 7 von 10 blättern." };
    case "yes":
      return { mood: "blueht", welk: -1, quip: "JAAA! ich blüh gleich mit." };
    default:
      return { mood: "wartet", welk: -1, quip: "und? erzähl! ich war ja nicht dabei." };
  }
}

/** The short note under "EIN SATZ FÜR SPÄTER". */
export const NOTE_MAX = 120;
