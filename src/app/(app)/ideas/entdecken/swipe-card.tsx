"use client";

// The swipe card: one idea, calm enough to decide in a second – what it is first (big title, one or two lines
// on what you do), then where · how long · what it costs, the day last and small. Tapped, it opens to the full
// screen with all of its description, the event and a real map of the place; tapped again it is small again.
// The compact card tightens itself step by step until everything fits (fitCard); the full one scrolls.
import { memo, useLayoutEffect, useRef } from "react";
import { IllustrationStrip } from "@/components/illustrations";
import { MapEmbed } from "@/components/map-embed";
import { mapSearchUrl } from "@/core/date-extras";
import type { DeckCardView } from "@/core/deck";
import { cn } from "@/lib/cn";

export type Verdict = "like" | "nope";

const DAUER = { small: "ein Abend", large: "halber Tag" } as const;
const SETTING = { indoor: "drinnen", outdoor: "draußen" } as const;

function costLabel(cost: number | null): string | null {
  if (cost === null) return null;
  return cost === 0 ? "gratis" : `~${cost} €`;
}

/** Where · how long · what it costs – three small facts in one row. */
function facts(card: DeckCardView) {
  const where = card.location ?? card.event?.venue ?? (card.setting ? SETTING[card.setting] : null);
  const cost = costLabel(card.costEur);
  return [where && { k: "wo", icon: "⌖", v: where }, { k: "dauer", icon: "◷", v: DAUER[card.size] }, cost && { k: "kosten", icon: "", v: cost }].filter(
    (f): f is { k: string; icon: string; v: string } => Boolean(f),
  );
}

/** The day, small: "Sa 31.10. · ab 18:00" (an event: its own day and time). */
function whenLine(card: DeckCardView): string | null {
  const w = card.when;
  if (!w) return null;
  return [w.day, w.time, w.note].filter(Boolean).join(" · ");
}

/** The place a map can show: the idea's own, else the event's venue. */
function mapPlace(card: DeckCardView): string | null {
  return card.location ?? card.event?.venue ?? null;
}

/** How many steps the compact card can tighten to fit its box (the rules are in globals.css). */
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
 * One idea as a card. Compact: the picture strip in its pastel, the sort small, the title big, a line or two on
 * what it is, and at the bottom where · how long · cost and the day. Full (`full`): the same, with all of the
 * description, the event and the map – it scrolls if it has to.
 *
 * Phones differ by 300 px in height: the compact card tightens step by step until everything fits (`fitCard`) –
 * 1: smaller picture · 2: one line of description · 3: small picture, smaller title · 4: no picture, no sort ·
 * 5: no description, the title on two lines. The bottom box is never cut. The card is light in the dark app – its
 * colors are fixed, not tokens.
 */
// Memoized: the deck renders again while a card is dragged (the stamp), the card itself does not change.
export const Card = memo(function Card({ card, partnerName, full = false }: { card: DeckCardView; partnerName: string; full?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    const inner = body.current;
    const rows = info.current;
    if (!el || !inner || !rows) return;
    if (full) {
      for (let step = 1; step <= DENSEST; step++) el.removeAttribute(`data-d${step}`);
      el.dataset.cardDense = "0";
      return;
    }
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
  }, [card, full]);
  const when = whenLine(card);
  const place = mapPlace(card);
  return (
    <div
      ref={box}
      data-card-dense={0}
      data-card-full={full ? "" : undefined}
      className={cn("swipe-card relative flex h-full flex-col rounded-[28px] bg-[#E7EEDF] text-[#1B2620] shadow-[0_18px_30px_rgba(0,0,0,0.4)]", full ? "touch-pan-y overflow-y-auto overscroll-contain" : "overflow-hidden")}
    >
      <IllustrationStrip names={card.art.illustrations} hex={card.art.hex} className={cn("sc-strip -mb-2.5 overflow-hidden rounded-t-[28px]", full ? "h-[120px] shrink-0" : "min-h-8 flex-[1_1_96px]")} />
      {/* The text never shrinks: a tall screen gives the picture more room, a short one takes it first – plain CSS. */}
      <div ref={body} className={cn("sc-body relative flex flex-col gap-2.5 p-5", full ? "flex-[1_0_auto]" : "flex-[0_0_auto]")}>
        <div className="sc-sorte flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#6A7566]">
          <span>{card.sorte}</span>
          {card.partnerSuper && <span className="rounded-full bg-[#F6DFD3] px-2 py-0.5 normal-case tracking-normal text-[#1B2620]">★ {partnerName} findet das super</span>}
          {card.kind === "revisit" && <span className="rounded-full bg-[#E6E0F2] px-2 py-0.5 normal-case tracking-normal text-[#1B2620]">🕰️ Liegt {card.waitingSince ?? "lange"} im Regal</span>}
        </div>
        <h2 className={cn("sc-title text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em]", !full && "line-clamp-3")}>{card.title}</h2>
        {card.note && <p className={cn("sc-note text-[15px] leading-snug text-[#3E4A3F]", !full && "line-clamp-2")}>{card.note}</p>}
        {full && card.event && (
          <div data-card-event className="flex flex-col gap-0.5 rounded-[18px] bg-[#F6DFD3] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6A7566]">Event</span>
            <span className="text-[17px] font-bold leading-tight">{card.event.title}</span>
            <span className="text-sm text-[#3E4A3F]">{[card.event.venue, card.event.when].filter(Boolean).join(" · ")}</span>
            {card.event.url && (
              <a href={card.event.url} target="_blank" rel="noopener noreferrer" className="mt-1 self-start text-sm font-bold underline">
                Zum Event ›
              </a>
            )}
          </div>
        )}
        {full && place && (
          // The map is only a picture here – a tap on it makes the card small like anywhere else; Maps has its own button.
          <div className="flex shrink-0 flex-col gap-2">
            <MapEmbed place={place} className="h-44 bg-[#DCEBD9]" />
            <a
              href={mapSearchUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              data-maps-link
              className="press inline-flex h-11 items-center justify-center gap-2 rounded-full border-2 border-[#1B2620] px-4 text-[15px] font-bold"
            >
              <span aria-hidden="true">📍</span> In Google Maps öffnen
            </a>
          </div>
        )}
        <div ref={info} data-card-info className="mt-auto flex shrink-0 flex-col gap-2">
          <ul className="flex flex-wrap gap-1.5">
            {facts(card).map((f) => (
              <li key={f.k} data-fact={f.k} className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-white px-2.5 text-[13px] font-bold">
                {f.icon && (
                  <span aria-hidden="true" className="text-[11px] text-[#6A7566]">
                    {f.icon}
                  </span>
                )}
                <span className="truncate">{f.v}</span>
              </li>
            ))}
          </ul>
          {(when || card.event) && (
            <p data-card-when className="sc-when flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-[#6A7566]">
              {card.event && !full && (
                <>
                  <span aria-hidden="true">♪</span>
                  <span className="truncate">{card.event.title}</span>
                  {when && <span aria-hidden="true">·</span>}
                </>
              )}
              {when && <span className="shrink-0">{when}</span>}
            </p>
          )}
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
