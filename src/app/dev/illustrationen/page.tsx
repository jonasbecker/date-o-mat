import type { Metadata } from "next";
import { IllustrationArt, IllustrationStrip } from "@/components/illustrations";
import { CARD_COLORS, CARD_COLOR_HEX, ILLUSTRATION_GROUPS, type Illustration } from "@/core/card-art";

export const metadata: Metadata = { title: "Illustrationen – Swipe-Karte" };

// Every drawing of the card's picture strip (SWIPE-KARTE.md §4) on all five pastels, and a few pairs.
const PAIRS: Illustration[][] = [
  ["crepes", "mikro"],
  ["teller", "glaeser"],
  ["boot", "sonne"],
  ["baum", "kerze"],
  ["zug", "berg"],
  ["tasse", "maske"],
];

export default function IllustrationsPage() {
  return (
    <main className="min-h-dvh bg-[#111A14] px-5 py-10 text-[#E7EEDF]">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-[32px] font-extrabold tracking-[-0.03em]">illustrationen.</h1>
          <span className="font-mono text-xs text-[#9FB09C]">Schlüssel für ideas.illustrations / deck_cards.illustrations · 1–2 pro Karte</span>
        </div>
        {Object.entries(ILLUSTRATION_GROUPS).map(([group, names]) => (
          <section key={group} className="flex flex-col gap-3">
            <h2 className="font-mono text-sm text-[#9FB09C]">{group}</h2>
            {names.map((name) => (
              <div key={name} className="grid grid-cols-[80px_repeat(5,minmax(0,1fr))] items-center gap-2" data-dev-illustration={name}>
                <span className="font-mono text-xs">{name}</span>
                {CARD_COLORS.map((color) => (
                  <div key={color} className="flex h-[88px] items-end justify-center rounded-2xl pt-2" style={{ background: CARD_COLOR_HEX[color] }}>
                    <IllustrationArt name={name} className="h-full w-auto" />
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-sm text-[#9FB09C]">zwei zusammen (wie auf der karte, 350 × 110)</h2>
          <div className="flex flex-wrap gap-4">
            {PAIRS.map((pair, i) => (
              <div key={pair.join("+")} className="flex flex-col gap-1">
                <IllustrationStrip names={pair} hex={CARD_COLOR_HEX[CARD_COLORS[i % CARD_COLORS.length]]} className="h-[110px] w-[350px] overflow-hidden rounded-[28px]" />
                <span className="font-mono text-xs text-[#9FB09C]">{pair.join(" + ")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
