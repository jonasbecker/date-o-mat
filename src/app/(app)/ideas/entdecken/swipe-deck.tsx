"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { buttonClass, Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { SizeChip } from "@/components/size-chip";
import { DECK_FILTER_LABEL, DECK_FILTERS, DECK_THEMES, matchesFilter, type DeckCardView, type DeckFilter } from "@/core/deck";
import { cn } from "@/lib/cn";
import { formatCost } from "@/lib/idea-input";
import { moreCardsAction, swipeAction, undoSwipeAction } from "./actions";

type Verdict = "like" | "super" | "nope";

const THRESHOLD_X = 100;
const THRESHOLD_UP = 110;
const FLY_MS = 220;

const THEME_LABEL = Object.fromEntries(DECK_THEMES.map((t) => [t.key, t.label])) as Record<string, string>;
// Light, fixed tones with dark ink – readable in dark mode too.
const TONE: Record<string, string> = {
  food: "bg-zitrone-soft",
  nature: "bg-minze-soft",
  culture: "bg-himbeere-soft",
  active: "bg-minze-soft",
  creative: "bg-zitrone-soft",
  cozy: "bg-himbeere-soft",
  new: "bg-zitrone-soft",
  free: "bg-minze-soft",
  romantic: "bg-himbeere-soft",
  trip: "bg-minze-soft",
  learn: "bg-zitrone-soft",
  night: "bg-himbeere-soft",
};

function Card({ card, partnerName }: { card: DeckCardView; partnerName: string }) {
  const cost = formatCost(card.costEur);
  return (
    <div className={cn("sticker flex h-full flex-col gap-3 overflow-hidden rounded-[28px] p-5 text-tinte", TONE[card.theme ?? ""] ?? "bg-zitrone-soft")}>
      <div className="flex flex-wrap gap-1.5 text-[12px] font-extrabold">
        {card.partnerSuper && <span className="rounded-full bg-zitrone px-2.5 py-0.5">⭐ {partnerName} findet das super</span>}
        {card.kind === "combo" && <span className="rounded-full bg-himmel px-2.5 py-0.5">🎟️ Event-Kombi</span>}
        {card.wildcard && <span className="rounded-full bg-lavendel px-2.5 py-0.5">🎲 Mal was anderes</span>}
        {card.theme && THEME_LABEL[card.theme] && <span className="rounded-full border-[1.5px] border-tinte/30 px-2.5 py-0.5">{THEME_LABEL[card.theme]}</span>}
      </div>
      <span className="text-6xl leading-none" aria-hidden="true">
        {card.emoji ?? "💡"}
      </span>
      <h2 className="font-display text-[27px] font-bold leading-tight">{card.title}</h2>
      {card.note && <p className="text-[16px] font-semibold leading-snug">{card.note}</p>}
      {card.event && (
        <div className="rounded-2xl border-2 border-tinte/20 bg-white/60 px-3.5 py-2.5 text-[14px] font-bold">
          <p className="font-extrabold">🎟️ {card.event.title}</p>
          <p>{card.event.when}</p>
          {card.event.venue && <p>📍 {card.event.venue}</p>}
          {card.bothFree === true && <p className="mt-1 text-[13px]">✓ Ihr habt beide Zeit</p>}
          {card.bothFree === false && <p className="mt-1 text-[13px]">✗ Da hat jemand von euch schon was vor</p>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-extrabold">
        <SizeChip size={card.size} />
        {cost && <span>{cost}</span>}
        {card.setting && <span>{card.setting === "indoor" ? "🏠 drinnen" : "🌳 draußen"}</span>}
        {card.location && <span>📍 {card.location}</span>}
      </div>
    </div>
  );
}

export function SwipeDeck({
  cards: serverCards,
  superLeft: superLeftInitially,
  generating,
  matches,
  ai,
  partnerName,
}: {
  cards: DeckCardView[];
  superLeft: boolean;
  generating: boolean;
  matches: number;
  ai: boolean;
  partnerName: string;
}) {
  const celebrate = useCelebrate();
  // Swiped here (hidden at once), and cards brought back with ↩️ (shown first).
  const [handled, setHandled] = useState<Set<string>>(() => new Set());
  const [restored, setRestored] = useState<DeckCardView[]>([]);
  const [filter, setFilter] = useState<DeckFilter>("all");
  // The card super-liked here – undoing that swipe gives the super-like back.
  const [superCard, setSuperCard] = useState<string | null>(null);
  const [match, setMatch] = useState<{ title: string; ideaId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState<{ id: string; verdict: Verdict } | null>(null);
  const [busy, startBusy] = useTransition();
  const [loading, startLoading] = useTransition();
  const start = useRef<{ x: number; y: number } | null>(null);

  const superLeft = superLeftInitially && !superCard;
  const seen = new Set<string>();
  const all = [...restored, ...serverCards].filter((c) => {
    if (seen.has(c.id) || handled.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const cards = all.filter((c) => matchesFilter(c, filter));
  const top = cards[0];
  const next = cards[1];

  function decide(verdict: Verdict) {
    if (!top || flying) return;
    if (verdict === "super" && !superLeft) {
      setMessage("Dein Super-Like für heute ist schon weg – morgen gibt's einen neuen ⭐");
      return;
    }
    const card = top;
    setMessage(null);
    setFlying({ id: card.id, verdict });
    setDrag(null);
    setTimeout(() => {
      setHandled((prev) => new Set(prev).add(card.id));
      setRestored((prev) => prev.filter((c) => c.id !== card.id));
      setFlying(null);
    }, FLY_MS);
    if (verdict === "super") setSuperCard(card.id);
    startBusy(async () => {
      const result = await swipeAction(card.id, verdict).catch(() => null);
      if (!result) {
        setHandled((prev) => {
          const copy = new Set(prev);
          copy.delete(card.id);
          return copy;
        });
        setMessage("Das hat nicht geklappt – bist du offline?");
        return;
      }
      if (!result.ok && result.error === "super_used") {
        setHandled((prev) => {
          const copy = new Set(prev);
          copy.delete(card.id);
          return copy;
        });
        setMessage("Dein Super-Like für heute ist schon weg – morgen gibt's einen neuen ⭐");
        return;
      }
      if (result.ok && result.match) {
        celebrate();
        setMatch(result.match);
      }
    });
  }

  function undo() {
    setMessage(null);
    startBusy(async () => {
      const result = await undoSwipeAction().catch(() => null);
      if (!result) return setMessage("Das hat nicht geklappt – bist du offline?");
      if (!result.ok) {
        setMessage(result.error === "planned" ? "Das ist schon als Date geplant – das Match bleibt 💞" : "Da gibt's nichts mehr rückgängig zu machen.");
        return;
      }
      const card = result.card;
      setHandled((prev) => {
        const copy = new Set(prev);
        copy.delete(card.id);
        return copy;
      });
      setRestored((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
      if (card.id === superCard) setSuperCard(null);
      if (!matchesFilter(card, filter)) setFilter("all");
    });
  }

  function more() {
    setMessage(null);
    startLoading(async () => {
      const result = await moreCardsAction(filter).catch(() => null);
      if (!result) return setMessage("Das hat nicht geklappt – bist du offline?");
      if (result.message) setMessage(result.message);
    });
  }

  // Keyboard: ← nope, → like, ↑ super, Backspace undo.
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (event: KeyboardEvent) => {
      if (match || (event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (event.key === "ArrowLeft") decide("nope");
      else if (event.key === "ArrowRight") decide("like");
      else if (event.key === "ArrowUp") decide("super");
      else if (event.key === "Backspace") undo();
      else return;
      event.preventDefault();
    };
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (flying) return;
    start.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    setDrag({ x: event.clientX - start.current.x, y: event.clientY - start.current.y });
  }
  function onPointerUp() {
    const d = drag;
    start.current = null;
    if (!d) return;
    if (d.x > THRESHOLD_X) decide("like");
    else if (d.x < -THRESHOLD_X) decide("nope");
    else if (d.y < -THRESHOLD_UP && Math.abs(d.x) < THRESHOLD_X) decide("super");
    else setDrag(null);
  }

  const flyTransform = (verdict: Verdict) =>
    verdict === "like" ? "translate(140%, 0) rotate(18deg)" : verdict === "nope" ? "translate(-140%, 0) rotate(-18deg)" : "translate(0, -140%)";
  const topStyle =
    flying && top && flying.id === top.id
      ? { transform: flyTransform(flying.verdict), transition: `transform ${FLY_MS}ms ease-in` }
      : drag
        ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` }
        : { transform: "none", transition: "transform 180ms ease-out" };
  const hint = drag ? (drag.x > 40 ? "like" : drag.x < -40 ? "nope" : drag.y < -50 ? "super" : null) : flying?.verdict ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Filter" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {DECK_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "shrink-0 rounded-full border-2 border-line px-3 py-1 text-[13px] font-extrabold whitespace-nowrap",
              filter === f ? "bg-ink text-bg" : "bg-surface text-ink",
            )}
          >
            {DECK_FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="relative h-[460px]">
        {next && (
          <div aria-hidden="true" className="absolute inset-0 scale-[0.96] opacity-70">
            <Card card={next} partnerName={partnerName} />
          </div>
        )}
        {top ? (
          <div
            key={top.id}
            role="group"
            aria-roledescription="Karte"
            aria-label={top.title}
            className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
            style={topStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              start.current = null;
              setDrag(null);
            }}
          >
            <Card card={top} partnerName={partnerName} />
            {hint && (
              <span
                aria-hidden="true"
                className={cn(
                  "sticker absolute top-6 rounded-2xl px-4 py-1.5 font-display text-2xl font-bold text-tinte",
                  hint === "like" && "left-6 -rotate-12 bg-minze",
                  hint === "nope" && "right-6 rotate-12 bg-himbeere",
                  hint === "super" && "left-1/2 -translate-x-1/2 bg-zitrone",
                )}
              >
                {hint === "like" ? "💚 Gerne!" : hint === "nope" ? "✕ Nö" : "⭐ Super!"}
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] border-[2.5px] border-dashed border-line px-6 text-center">
            {generating || loading ? (
              <>
                <span className="animate-wiggle text-5xl" aria-hidden="true">
                  🔀
                </span>
                <p className="font-display text-xl font-semibold">Neue Ideen werden gemischt …</p>
                <p className="text-sm font-bold text-muted">Dauert etwa eine halbe Minute.</p>
              </>
            ) : (
              <>
                <span className="text-5xl" aria-hidden="true">
                  {filter === "all" ? "🎉" : "🔍"}
                </span>
                <p className="font-display text-xl font-semibold">{filter === "all" ? "Alles durchgeswipt!" : "Gerade nichts Passendes"}</p>
                {ai ? (
                  <Button onClick={more} disabled={loading}>
                    {filter === "all" ? "✨ Neue Ideen holen" : `✨ Mehr „${DECK_FILTER_LABEL[filter].replace(/^\S+\s/, "")}“ holen`}
                  </Button>
                ) : (
                  <p className="text-sm font-bold text-muted">Neue Karten macht die KI – sie ist noch nicht eingerichtet.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button type="button" aria-label="Nein" onClick={() => decide("nope")} disabled={!top} className="sticker press flex size-16 items-center justify-center rounded-full bg-himbeere text-2xl text-tinte disabled:opacity-40">
          ✕
        </button>
        <button type="button" aria-label="Rückgängig" onClick={undo} disabled={busy} className="sticker press flex size-12 items-center justify-center rounded-full bg-surface text-xl text-ink disabled:opacity-40">
          ↩️
        </button>
        <button
          type="button"
          aria-label="Super-Like"
          title={superLeft ? "Einmal am Tag: „Das will ich unbedingt!“" : "Morgen gibt's einen neuen Super-Like"}
          onClick={() => decide("super")}
          disabled={!top || !superLeft}
          className="sticker press flex size-12 items-center justify-center rounded-full bg-zitrone text-xl text-tinte disabled:opacity-40"
        >
          ⭐
        </button>
        <button type="button" aria-label="Gefällt mir" onClick={() => decide("like")} disabled={!top} className="sticker press flex size-16 items-center justify-center rounded-full bg-minze text-2xl text-tinte disabled:opacity-40">
          💚
        </button>
      </div>

      <p role="status" className="min-h-5 text-center text-sm font-bold text-muted">
        {message ?? (top ? `${cards.length} ${cards.length === 1 ? "Karte" : "Karten"} · nur wenn ihr beide 💚 gebt, gibt's ein Match` : "")}
      </p>

      {top && ai && cards.length < 8 && !generating && (
        <button type="button" onClick={more} disabled={loading} className="self-center text-sm font-extrabold text-muted underline disabled:opacity-60">
          {loading ? "Mische neue Ideen …" : filter === "all" ? "✨ Mehr Ideen holen" : `✨ Mehr „${DECK_FILTER_LABEL[filter].replace(/^\S+\s/, "")}“ holen`}
        </button>
      )}

      {matches > 0 && (
        <Link href="/ideas" className="self-center text-sm font-extrabold underline">
          💞 {matches} {matches === 1 ? "Match" : "Matches"} auf eurer Wunschliste
        </Link>
      )}

      {match && (
        <div role="dialog" aria-modal="true" aria-labelledby="match-title" className="fixed inset-0 z-40 flex items-center justify-center bg-tinte/70 px-6">
          <div className="sticker animate-pop-in flex w-full max-w-sm flex-col items-center gap-4 rounded-[28px] bg-himbeere-soft p-6 text-center text-tinte">
            <span className="text-6xl" aria-hidden="true">
              💞
            </span>
            <h2 id="match-title" className="font-display text-4xl font-bold">
              Match!
            </h2>
            <p className="text-lg font-bold">
              Ihr wollt beide: <span className="font-extrabold">{match.title}</span>
            </p>
            <p className="text-sm font-semibold">Steht jetzt auf eurer Wunschliste.</p>
            <Link href={`/plan?idea=${match.ideaId}`} className={buttonClass("primary", "md", "w-full")}>
              📅 Jetzt planen
            </Link>
            <button type="button" onClick={() => setMatch(null)} className="text-sm font-extrabold underline">
              Weiter swipen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
