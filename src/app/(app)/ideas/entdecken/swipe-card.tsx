"use client";

// The swipe card: one idea as a light card with its picture strip, day and WO · DAUER · KOSTEN, and the stamp
// that shows while it is dragged. It tightens itself step by step until everything fits (fitCard).
import { memo, useLayoutEffect, useRef } from "react";
import { IllustrationStrip } from "@/components/illustrations";
import type { DeckCardView } from "@/core/deck";
import { cn } from "@/lib/cn";

export type Verdict = "like" | "nope";

const DAUER = { small: { v: "ein Abend", s: "ca. 2–3 Stunden" }, large: { v: "halber Tag", s: "ca. 5 Stunden" } } as const;
const SETTING = { indoor: "drinnen", outdoor: "draußen" } as const;

function costRow(cost: number | null): { v: string; s: string } {
  if (cost === null) return { v: "offen", s: "schätzt selbst" };
  if (cost === 0) return { v: "gratis", s: "kostet nix" };
  return { v: `~${cost} €`, s: "für euch zwei" };
}

/** The rows of the white box at the bottom of the card: WO · (EVENT) · DAUER · KOSTEN. */
function infoRows(card: DeckCardView) {
  const where = card.location ?? card.event?.venue ?? (card.setting ? SETTING[card.setting] : "sucht's euch aus");
  const rows = [{ icon: "⌖", bg: "#DCEBD9", k: "WO", v: where, s: card.setting && card.location ? SETTING[card.setting] : "" }];
  if (card.event) rows.push({ icon: "♪", bg: "#F6DFD3", k: "EVENT", v: card.event.title, s: [card.event.venue, card.when?.time].filter(Boolean).join(", ") });
  rows.push({ icon: "◷", bg: "#F7EBC4", k: "DAUER", ...DAUER[card.size] });
  rows.push({ icon: "€", bg: "#DCE7F5", k: "KOSTEN", ...costRow(card.costEur) });
  return rows;
}

/** How many steps the card can tighten to fit its box (see `Card`, the rules are in globals.css). */
const DENSEST = 5;

/**
 * Tightens the card until its content fits: sets `data-d1` … `data-dN` (globals.css, `.swipe-card`) and
 * `data-card-dense` right on the element and measures after each step. Plain DOM, no React state: it runs
 * whenever the card or its content changes size, so it cannot miss the moment the card is laid out
 * (a page Next rendered hidden, Safari's bars, fonts arriving).
 */
function fitCard(card: HTMLElement, info: HTMLElement) {
  // e2e: checks that the plain CSS alone (the picture giving way) already keeps the info box whole.
  if ((window as { __noCardFit?: boolean }).__noCardFit) return;
  for (let dense = 0; dense <= DENSEST; dense++) {
    for (let step = 1; step <= DENSEST; step++) card.toggleAttribute(`data-d${step}`, step <= dense);
    card.dataset.cardDense = String(dense);
    // Not laid out (hidden): nothing to measure – the observer calls again once it is shown.
    if (card.clientHeight === 0) return;
    // Where the info box really ends (geometry – Safari and Chrome agree on it, unlike scrollHeight).
    if (info.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 8) return;
  }
}

/**
 * One idea as a card (SWIPE-KARTE.md §2, SwipeC.html variant 2): the picture strip in its pastel, the sort
 * and number, the day big (the event's or the next free evening), the title, and WO · DAUER · KOSTEN.
 * The card is light in the dark app – its colors are fixed, not tokens.
 *
 * Phones differ by 300 px in height (Safari's bars, safe areas), and a card by a row (event) or a chip:
 * the card tightens step by step until everything fits (`fitCard`) – the picture first, then the small
 * lines, then the type, the title's second line last; the info box is never cut.
 * 1: smaller picture · 2: no sub-lines · 3: small picture, smaller type · 4: no picture, no Sorte · 5: title on one line.
 */
// Memoized: the deck renders again while a card is dragged (the stamp), the card itself does not change.
export const Card = memo(function Card({ card, partnerName, pos }: { card: DeckCardView; partnerName: string; pos?: string }) {
  const when = card.when;
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const inner = body.current;
    const rows = info.current;
    if (!el || !inner || !rows) return;
    let frame = 0;
    const fit = () => fitCard(el, rows);
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    // The card's box and everything in it: any size change (shown, rotated, fonts, a longer title) fits again.
    const ro = new ResizeObserver(later);
    ro.observe(el);
    for (const child of inner.children) ro.observe(child);
    const timer = setTimeout(fit, 400);
    void document.fonts?.ready.then(later);
    document.fonts?.addEventListener?.("loadingdone", later);
    window.addEventListener("pageshow", later);
    document.addEventListener("visibilitychange", later);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      ro.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", later);
      window.removeEventListener("pageshow", later);
      document.removeEventListener("visibilitychange", later);
    };
  }, [card]);
  return (
    <div ref={box} data-card-dense={0} className="swipe-card relative flex h-full flex-col overflow-hidden rounded-[28px] bg-[#E7EEDF] text-[#1B2620] shadow-[0_18px_30px_rgba(0,0,0,0.4)]">
      <IllustrationStrip names={card.art.illustrations} hex={card.art.hex} className="sc-strip -mb-2.5 min-h-8 shrink basis-[110px] overflow-hidden" />
      {/* The text never shrinks (flex 1 0 auto): when room is short the picture gives way first – plain CSS. */}
      <div ref={body} className="sc-body relative flex flex-[1_0_auto] flex-col gap-3.5 p-5">
        <div className="sc-sorte flex items-center justify-between gap-2">
          <span className="inline-flex h-[26px] items-center truncate rounded-full bg-white px-2.5 font-mono text-[11px]">Sorte: {card.sorte}</span>
          {pos && <span className="shrink-0 font-mono text-[11px] text-[#6A7566]">Nº {pos}</span>}
        </div>
        {(card.partnerSuper || card.kind === "revisit") && (
          <div className="sc-chips -mt-1.5 flex flex-wrap gap-1.5 font-mono text-[10px]">
            {card.partnerSuper && <span className="rounded-full bg-[#F6DFD3] px-2.5 py-1">★ {partnerName} findet das super</span>}
            {card.kind === "revisit" && <span className="rounded-full bg-[#E6E0F2] px-2.5 py-1">🕰️ Liegt {card.waitingSince ?? "lange"} im Regal</span>}
          </div>
        )}
        {when && (
          <div className="sc-when flex flex-col gap-1" data-card-when>
            <span className="sc-day text-[42px] font-extrabold leading-[0.92] tracking-[-0.055em]">{when.day}</span>
            <span className={cn("sc-time flex flex-wrap items-center gap-x-2 text-[17px] font-bold", when.free === true ? "text-[#2E7D46]" : when.free === false ? "text-[#A0522D]" : "text-[#6A7566]")}>
              {when.time && (
                <>
                  <span>{when.time}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>{when.note}</span>
            </span>
          </div>
        )}
        <div className="sc-rule border-t-[1.5px] border-[#C9D4C4] pt-3">
          <h2 className="sc-title line-clamp-2 text-2xl font-extrabold leading-[1.05] tracking-[-0.03em]">{card.title}</h2>
        </div>
        <div ref={info} data-card-info className="mt-auto shrink-0 overflow-hidden rounded-[18px] bg-white">
          {infoRows(card).map((r, i) => (
            <div key={r.k} className={cn("sc-row grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 py-[9px]", i > 0 && "border-t border-[#EDF3EA]")}>
              <span aria-hidden="true" className="sc-icon flex size-7 items-center justify-center rounded-[9px] text-[13px] font-extrabold" style={{ background: r.bg }}>
                {r.icon}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-bold leading-[1.15]">{r.v}</span>
                {r.s && <span className="sc-sub truncate text-xs text-[#6A7566]">{r.s}</span>}
              </span>
              <span className="font-mono text-[10px] text-[#6A7566]">{r.k}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/** EINPFLANZEN (right, top left, green) / KOMPOST (left, top right, brown) – from 30 % of the way. */
export function Stamp({ verdict }: { verdict: Verdict }) {
  return (
    <span
      aria-hidden="true"
      data-stamp={verdict}
      className={cn(
        "pointer-events-none absolute top-[62px] z-10 rounded-xl border-4 bg-[rgba(231,238,223,0.85)] px-3 py-1.5 text-[28px] font-extrabold tracking-[0.02em]",
        verdict === "like" ? "left-[22px] -rotate-[14deg] border-[#2E7D46] text-[#2E7D46]" : "right-[22px] rotate-[14deg] border-[#8A6440] text-[#8A6440]",
      )}
    >
      {verdict === "like" ? "EINPFLANZEN" : "KOMPOST"}
    </span>
  );
}
