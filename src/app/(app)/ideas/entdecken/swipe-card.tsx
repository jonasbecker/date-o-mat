"use client";

// The swipe card, V2 "Kacheln" (docs/design/garten/swipe-karte-v2/, variante 2): the idea's banner on top, the title
// and two lines on what it is, three tiles (wo · dauer · kosten) and the day at the bottom in a dark strip. Nothing
// changes the card's height – texts are clamped; on a tall phone the banner gets the extra room, on a short one it
// gives way first (fitCard). Tapped, it opens to the full screen: all of it, the event, a real map of the place and a
// bar at the bottom to compost or plant it right there; ✕ (or a tap) makes it small again.
import { memo, useLayoutEffect, useRef, useState } from "react";
import { Banner } from "@/components/banner";
import { MapEmbed } from "@/components/map-embed";
import { mapSearchUrl } from "@/core/date-extras";
import type { DeckCardView } from "@/core/deck";
import { cn } from "@/lib/cn";

export type Verdict = "like" | "nope";

const DAUER = { small: "ein Abend", large: "halber Tag" } as const;
const SETTING = { indoor: "drinnen", outdoor: "draußen" } as const;

function costLabel(cost: number | null): string {
  if (cost === null) return "offen";
  return cost === 0 ? "gratis" : `~${cost} €`;
}

/** The place a map can show: the idea's own, else the event's venue. */
function mapPlace(card: DeckCardView): string | null {
  return card.location ?? card.event?.venue ?? null;
}

/** Wo · Dauer · Kosten – never empty (no place: drinnen/draußen, else "egal"). */
function tiles(card: DeckCardView) {
  return [
    // The place up to its first comma ("RheinEnergieStadion, Aachener Straße …" → the stadium); the map gets all of it.
    { k: "wo", label: "WO", icon: "⌖", v: mapPlace(card)?.split(",")[0].trim() || (card.setting ? SETTING[card.setting] : "egal"), cls: "bg-[#DCEBD9] text-[#163A22]" },
    { k: "dauer", label: "DAUER", icon: "◷", v: DAUER[card.size], cls: "bg-[#F7EBC4] text-[#3A2E10]" },
    { k: "kosten", label: "KOSTEN", icon: "€", v: costLabel(card.costEur), cls: "bg-[#DCE7F5] text-[#16283E]" },
  ];
}

/** The day: "Sa 31.10." + "ab 18:00" (an event: its own day and time) and whether both are free then. */
function day(card: DeckCardView): { date: string; time: string; free: boolean; pill: string } {
  const w = card.when;
  if (!w || w.free !== true) return { date: w?.day ?? "irgendwann.", time: w?.time ?? "", free: false, pill: w?.note === "kalender fehlt" ? "kalender fehlt" : "kein Slot frei" };
  return { date: w.day, time: w.time, free: true, pill: "✓ beide frei" };
}

function longestWord(text: string): number {
  return Math.max(...text.split(/\s+/).map((w) => w.length));
}

/** How many steps the compact card can tighten to fit its box (the rules are in globals.css, `.swipe-card`). */
const DENSEST = 4;

/**
 * Tightens the card until the date strip is inside it: sets `data-d1` … `data-dN` right on the element and measures
 * after each step. Plain DOM, no React state: it runs whenever the card or its content changes size, so it cannot
 * miss the moment the card is laid out (a page Next rendered hidden, Safari's bars, fonts arriving).
 */
function fitCard(card: HTMLElement, info: HTMLElement) {
  // e2e: checks that the plain CSS alone (the banner giving way) already keeps the strip whole.
  if ((window as { __noCardFit?: boolean }).__noCardFit) return;
  for (let dense = 0; dense <= DENSEST; dense++) {
    for (let step = 1; step <= DENSEST; step++) card.toggleAttribute(`data-d${step}`, step <= dense);
    card.dataset.cardDense = String(dense);
    // Not laid out (hidden): nothing to measure – the observer calls again once it is shown.
    if (card.clientHeight === 0) return;
    // Where the strip really ends (geometry – Safari and Chrome agree on it, unlike scrollHeight).
    if (info.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 8) return;
  }
}

const PILL = "inline-flex h-[26px] items-center rounded-full px-2.5 font-mono text-[11px] tracking-[0.03em]";

type CardProps = {
  card: DeckCardView;
  partnerName: string;
  full?: boolean;
  /** "Nº 5 / 74": where this card is among all of them. */
  nr?: number;
  total?: number;
  /** Full screen: ✕, and the bar at the bottom. */
  onClose?: () => void;
  onDecide?: (verdict: Verdict) => void;
};

/**
 * One idea as a card. Phones differ by 300 px in height: the banner takes what is left (it fills any box, core/banners.ts)
 * and gives way first; then the card tightens step by step until the strip fits (`fitCard`) – 1: smaller tiles ·
 * 2: one line of description · 3: no description · 4: one line of title. The card is light in the dark app – its
 * colors are fixed, not tokens.
 */
// Memoized: the deck renders again while a card is dragged (the stamp), the card itself does not change.
export const Card = memo(function Card({ card, partnerName, full = false, nr, total, onClose, onDecide }: CardProps) {
  const box = useRef<HTMLDivElement>(null);
  const info = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    const strip = info.current;
    if (!el) return;
    if (full || !strip) {
      for (let step = 1; step <= DENSEST; step++) el.removeAttribute(`data-d${step}`);
      el.dataset.cardDense = "0";
      return;
    }
    let frame = 0;
    const fit = () => fitCard(el, strip);
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    // The card's box and everything in it: any size change (shown, rotated, fonts, a longer title) fits again.
    const ro = new ResizeObserver(later);
    ro.observe(el);
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
  const when = day(card);
  const place = mapPlace(card);
  const counter = nr && total ? `Nº ${nr} / ${total}` : null;
  const extra = card.partnerSuper ? `★ ${partnerName} findet das super` : card.kind === "revisit" ? `🕰️ Liegt ${card.waitingSince ?? "lange"} im Regal` : null;

  const pills = (
    <>
      <span className={cn(PILL, "absolute left-3.5 top-3.5 bg-white/90 uppercase text-[#1B2620]")}>{card.sorte}</span>
      {extra && <span className={cn(PILL, "absolute bottom-3 left-3.5 bg-white/90 font-sans text-[12px] font-bold tracking-normal text-[#1B2620]")}>{extra}</span>}
    </>
  );

  if (full) {
    return (
      <div ref={box} data-card-dense={0} className="swipe-card relative flex h-full flex-col overflow-hidden rounded-[28px] bg-[#E7EEDF] text-[#1B2620] shadow-[0_18px_30px_rgba(0,0,0,0.4)]">
        {/* The banner takes what the content leaves (no place, no map: more banner, never an empty card). */}
        <div className="relative min-h-[150px] flex-[1_0_150px]">
          <Banner scene={card.art.scene} className="absolute inset-0" />
          {pills}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Schließen" className="press absolute right-3 top-2.5 flex size-9 items-center justify-center rounded-full bg-[rgba(17,26,20,0.6)] text-[#E7EEDF]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
        {/* It scrolls, and a scroll container starts a new touch-action: pan-y here, or the browser takes a sideways swipe. */}
        <div data-card-full className="flex min-h-0 flex-[0_1_auto] touch-pan-y flex-col overflow-y-auto overscroll-contain px-5 pb-[96px] pt-[18px]">
          <div className="flex items-end justify-between gap-3">
            <span data-card-when className="text-[36px] font-extrabold leading-[0.95] tracking-[-0.055em]">
              {when.date}
            </span>
            {counter && <span className="shrink-0 pb-1 font-mono text-[11px] text-[#6A7566]">{counter}</span>}
          </div>
          <p className={cn("mt-1.5 text-[15px] font-bold", when.free ? "text-[#2E7D46]" : "text-[#8A6440]")}>
            {[when.time, when.free ? "✓ ihr habt beide Zeit" : when.pill].filter(Boolean).join(" · ")}
          </p>
          <h2 className="mt-3.5 line-clamp-2 text-[28px] font-extrabold leading-[1.04] tracking-[-0.03em]">{card.title}</h2>
          {/* Three lines; the rest behind a small button (the text itself stays part of the card – a tap on it is a tap on the card). */}
          {card.note && <p className={cn("mt-2 text-[15px] leading-[1.4] text-[#4A5547]", !open && "line-clamp-3")}>{card.note}</p>}
          {card.note && card.note.length > 120 && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1 self-start text-sm font-bold underline">
              {open ? "weniger" : "ganzer Text"}
            </button>
          )}
          <ul className="mt-3.5 flex flex-wrap gap-2">
            {tiles(card).map((t) => (
              <li key={t.k} data-fact={t.k} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold">
                <span aria-hidden="true" className="text-xs text-[#6A7566]">
                  {t.icon}
                </span>
                <span className="truncate">{t.v}</span>
              </li>
            ))}
          </ul>
          {card.event && (
            <div data-card-event className="mt-4 flex flex-col gap-0.5 rounded-[18px] bg-[#F6DFD3] px-4 py-3">
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
          {place && (
            // The map is only a picture here – a tap on it makes the card small like anywhere else; Maps has its own button.
            <>
              <MapEmbed place={place} className="mt-4 h-[124px] shrink-0 bg-[#DCEBD9]" />
              <a
                href={mapSearchUrl(place)}
                target="_blank"
                rel="noopener noreferrer"
                data-maps-link
                className="press mt-2.5 inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#1B2620] px-4 text-[15px] font-bold"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
                In Google Maps öffnen
              </a>
            </>
          )}
        </div>
        {onDecide && (
          // Decide right here instead of swiping back first.
          <div data-card-bar className="absolute inset-x-0 bottom-0 flex h-[82px] items-end gap-2.5 bg-[linear-gradient(180deg,rgba(231,238,223,0)_0%,#E7EEDF_28%)] px-4 pb-4 pt-3.5">
            <button type="button" onClick={() => onDecide("nope")} className="press h-[52px] flex-1 rounded-full border-2 border-[#8A6440] text-base font-bold text-[#6A4A2E]">
              Kompost
            </button>
            <button type="button" onClick={() => onDecide("like")} className="press flex h-[52px] flex-[1.5] items-center justify-center gap-2 rounded-full bg-[#2E7D46] text-base font-bold text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 21v-9M12 12c0-4 3-6 7-6 0 4-3 6-7 6zM12 14c0-3-2-5-6-5 0 3 2 5 6 5z" />
              </svg>
              Einpflanzen
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={box} data-card-dense={0} className="swipe-card @container relative flex h-full flex-col overflow-hidden rounded-[28px] bg-[#E7EEDF] text-[#1B2620] shadow-[0_18px_30px_rgba(0,0,0,0.4)]">
      {/* The banner takes the room the text leaves – on a tall phone more than 170, on a short one less. */}
      <div className="sc-banner relative min-h-[72px] flex-[1_1_170px]">
        <Banner scene={card.art.scene} className="absolute inset-0" />
        {pills}
        {counter && <span className={cn(PILL, "absolute right-3.5 top-3.5 bg-[rgba(17,26,20,0.55)] text-[#E7EEDF]")}>{counter}</span>}
      </div>
      <div className="sc-body flex shrink-0 flex-col px-5 pb-[18px] pt-[18px]">
        <h2 className="sc-title line-clamp-2 text-[28px] font-extrabold leading-[1.04] tracking-[-0.03em]">{card.title}</h2>
        {/* A combo names its event first – the strip below has only room for the day. */}
        {(card.note || card.event) && (
          <p className="sc-note mt-2 line-clamp-2 text-[15px] leading-[1.4] text-[#4A5547]">
            {card.event && (
              <span className="font-bold text-[#1B2620]">
                <span aria-hidden="true">♪ </span>
                <span>{card.event.title}</span>
              </span>
            )}
            {card.event && card.note && " – "}
            {card.note}
          </p>
        )}
        <ul className="sc-tiles mt-4 grid grid-cols-[1.3fr_1fr_1fr] gap-2">
          {tiles(card).map((t) => (
            <li key={t.k} data-fact={t.k} className={cn("sc-tile flex h-[92px] flex-col justify-between rounded-[18px] px-3 py-2.5", t.cls)}>
              <span className="flex items-center justify-between">
                <span className="font-mono text-[10px] opacity-70">{t.label}</span>
                <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white/70 text-xs font-extrabold">
                  {t.icon}
                </span>
              </span>
              {/* A long single word ("Rheinpark", "RheinEnergieStadion") gets smaller instead of breaking mid-word; WO is the widest tile. */}
              <span className={cn("line-clamp-2 font-extrabold leading-[1.08] hyphens-auto [overflow-wrap:anywhere]", longestWord(t.v) > 11 ? "text-xs" : longestWord(t.v) > 7 ? "text-sm" : "text-base")}>{t.v}</span>
            </li>
          ))}
        </ul>
        <div ref={info} data-card-info className="mt-4 flex h-[58px] items-center justify-between gap-2 rounded-[20px] bg-[#163A22] pl-[18px] pr-3 text-[#E7EEDF]">
          {/* A narrow card puts the time under the day, so neither is cut. */}
          <span data-card-when className="flex min-w-0 items-baseline gap-2.5 @max-[339px]:flex-col @max-[339px]:gap-0">
            <span className="shrink-0 text-[22px] font-extrabold tracking-[-0.03em]">{when.date}</span>
            {when.time && <span className="truncate font-mono text-xs text-[#C9D4C4]">{when.time}</span>}
          </span>
          <span className={cn("inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-bold text-white", when.free ? "bg-[#2E7D46]" : "bg-[#8A6440]")}>{when.pill}</span>
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
