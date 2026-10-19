"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { buttonClass, Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { flyToWishlist } from "@/components/fly-to-wishlist";
import { Info } from "@/components/info";
import { SizeChip } from "@/components/size-chip";
import { WISHLIST_ADDED_EVENT } from "@/components/wishlist-badge";
import { DECK_THEMES, matchesFilter, type DeckCardView } from "@/core/deck";
import { activeFilterCount, filterSummary } from "@/core/filters";
import { FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { cn } from "@/lib/cn";
import { formatCost } from "@/lib/idea-input";
import { moreCardsAction, swipeAction, undoSwipeAction } from "./actions";

type Verdict = "like" | "nope";

const THRESHOLD_X = 100;
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

function Card({ card, partnerName, compact }: { card: DeckCardView; partnerName: string; compact?: boolean }) {
  const cost = formatCost(card.costEur);
  return (
    <div className={cn("sticker flex h-full flex-col overflow-hidden text-tinte", compact ? "gap-2 rounded-[24px] p-4 pb-[4.5rem]" : "gap-3 rounded-[28px] p-5", TONE[card.theme ?? ""] ?? "bg-zitrone-soft")}>
      <div className={cn("flex shrink-0 flex-wrap gap-1.5 text-[12px] font-extrabold", compact && "pr-24")}>
        {card.kind === "revisit" && <span className="rounded-full bg-lavendel px-2.5 py-0.5">🕰️ Steht {card.waitingSince ?? "lange"} auf eurer Liste</span>}
        {card.partnerSuper && <span className="rounded-full bg-zitrone px-2.5 py-0.5">⭐ {partnerName} findet das super</span>}
        {card.kind === "combo" && <span className="rounded-full bg-himmel px-2.5 py-0.5">🎟️ Event-Kombi</span>}
        {card.wildcard && <span className="rounded-full bg-lavendel px-2.5 py-0.5">🎲 Mal was anderes</span>}
        {card.theme && THEME_LABEL[card.theme] && <span className="rounded-full border-[1.5px] border-tinte/30 px-2.5 py-0.5">{THEME_LABEL[card.theme]}</span>}
      </div>
      <span className={cn("shrink-0 leading-none", compact ? "text-4xl" : "text-6xl")} aria-hidden="true">
        {card.emoji ?? "💡"}
      </span>
      <h2 className={cn("shrink-0 font-display font-bold leading-tight", compact ? "line-clamp-2 text-[22px]" : "text-[27px]")}>{card.title}</h2>
      {/* The description gives way when the card is short: it is clipped instead of pushing the facts out of the card. */}
      {card.note && (
        <p className={cn("min-h-0 overflow-hidden font-semibold leading-snug", compact ? "text-[15px]" : "text-[16px]")}>{card.note}</p>
      )}
      {card.event && (
        <div className={cn("shrink-0 rounded-2xl border-2 border-tinte/20 bg-white/60 font-bold", compact ? "px-3 py-1.5 text-[13px]" : "px-3.5 py-2.5 text-[14px]")}>
          <p className="font-extrabold">🎟️ {card.event.title}</p>
          <p>{card.event.when}</p>
          {card.event.venue && <p>📍 {card.event.venue}</p>}
          {card.bothFree === true && <p className="mt-1 text-[13px]">✓ Ihr habt beide Zeit</p>}
          {card.bothFree === false && <p className="mt-1 text-[13px]">✗ Da hat jemand von euch schon was vor</p>}
        </div>
      )}
      {card.kind === "revisit" && !compact && <p className="text-[15px] font-extrabold">Noch Lust? 💚 = bleibt drauf · ✕ = weg damit (wenn ihr euch einig seid)</p>}
      <div className="mt-auto flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-extrabold">
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
  generating,
  matches,
  ai,
  partnerName,
  compact = false,
}: {
  cards: DeckCardView[];
  generating: boolean;
  matches: number;
  ai: boolean;
  partnerName: string;
  /** On the start page, below the step card: the card and its buttons, nothing else. */
  compact?: boolean;
}) {
  const celebrate = useCelebrate();
  // Swiped here (hidden at once), and cards brought back with ↩️ (shown first).
  const [handled, setHandled] = useState<Set<string>>(() => new Set());
  const [restored, setRestored] = useState<DeckCardView[]>([]);
  const [storedFilter, setFilter] = useIdeaFilter();
  // The start page has no filter button – it shows every card.
  const filter = compact ? {} : storedFilter;
  const filtered = activeFilterCount(filter) > 0;
  const [match, setMatch] = useState<{ title: string; ideaId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [flying, setFlying] = useState<{ id: string; verdict: Verdict } | null>(null);
  const [busy, startBusy] = useTransition();
  // While an undo is on its way, the top card is about to change – no swiping.
  const [undoing, startUndo] = useTransition();
  const [loading, startLoading] = useTransition();
  const start = useRef<{ x: number; y: number } | null>(null);
  const topEl = useRef<HTMLDivElement | null>(null);
  // What this visit has done so far – the deck shows its progress.
  const [stats, setStats] = useState({ swiped: 0, liked: 0 });
  const verdicts = useRef<Verdict[]>([]);
  // The fly-out of the last swipe; an undo right after must not be overtaken by it.
  const flyTimer = useRef<{ timer: ReturnType<typeof setTimeout>; id: string } | null>(null);

  const seen = new Set<string>();
  const all = [...restored, ...serverCards].filter((c) => {
    if (seen.has(c.id) || handled.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const cards = all.filter((c) => matchesFilter(c, filter));
  const top = cards[0];
  const next = cards[1];
  const afterNext = cards[2];

  function decide(verdict: Verdict) {
    if (!top || flying || undoing) return;
    const card = top;
    setMessage(null);
    verdicts.current.push(verdict);
    setStats((s) => ({ swiped: s.swiped + 1, liked: s.liked + (verdict === "like" ? 1 : 0) }));
    // A like is felt: the 💚 flies to the 💡 (Android also buzzes); a pass is a short tick.
    if (verdict === "like") {
      if (topEl.current) flyToWishlist(topEl.current.getBoundingClientRect());
    } else {
      try {
        navigator.vibrate?.(8);
      } catch {
        // vibration is a bonus
      }
    }
    setFlying({ id: card.id, verdict });
    setDrag(null);
    flyTimer.current = { id: card.id, timer: setTimeout(() => landed(card.id), FLY_MS) };
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
      if (!result.ok) {
        setMessage(`Diese Karte ist schon weg – vielleicht hat ${partnerName} gerade entschieden.`);
        return;
      }
      if (result.ok && result.match) {
        celebrate();
        setMatch(result.match);
      } else if (result.ok) {
        const notes: Partial<Record<string, string>> = {
          keep: "Bleibt auf eurer Wunschliste 💚",
          archive: "Von der Wunschliste genommen – ihr wart euch einig.",
        };
        // A new idea on the wishlist (not one the other already put there): the 💡 counts up.
        if (result.saved) window.dispatchEvent(new Event(WISHLIST_ADDED_EVENT));
        if (result.saved) setMessage(compact ? "Auf der Wunschliste 💚" : `Steht auf eurer Wunschliste 💚 Will ${partnerName} auch, ist's ein Match.`);
        else if (notes[result.outcome]) setMessage(notes[result.outcome]!);
        else if (card.kind === "revisit" && verdict === "nope") setMessage(`Wenn ${partnerName} auch ✕ sagt, fliegt sie von der Liste.`);
      }
    });
  }

  function landed(id: string) {
    if (flyTimer.current?.id === id) {
      clearTimeout(flyTimer.current.timer);
      flyTimer.current = null;
    }
    setHandled((prev) => new Set(prev).add(id));
    setRestored((prev) => prev.filter((c) => c.id !== id));
    setFlying(null);
  }

  function undo() {
    if (undoing) return;
    if (flyTimer.current) landed(flyTimer.current.id);
    setMessage(null);
    startUndo(async () => {
      const result = await undoSwipeAction().catch(() => null);
      if (!result) return setMessage("Das hat nicht geklappt – bist du offline?");
      if (!result.ok) {
        setMessage(result.error === "planned" ? "Das ist schon als Date geplant – die Idee bleibt 💞" : "Da gibt's nichts mehr rückgängig zu machen.");
        return;
      }
      const card = result.card;
      const undone = verdicts.current.pop();
      if (undone) setStats((s) => ({ swiped: Math.max(0, s.swiped - 1), liked: Math.max(0, s.liked - (undone === "like" ? 1 : 0)) }));
      setHandled((prev) => {
        const copy = new Set(prev);
        copy.delete(card.id);
        return copy;
      });
      setRestored((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
      if (!matchesFilter(card, filter)) setFilter({});
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

  // Keyboard: ← nope, → like, Backspace undo.
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (event: KeyboardEvent) => {
      if (match || (event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      if (event.key === "ArrowLeft") decide("nope");
      else if (event.key === "ArrowRight") decide("like");
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
    else setDrag(null);
  }

  const flyTransform = (verdict: Verdict) =>
    verdict === "like"
      ? "translate(140%, 0) rotate(18deg)"
      : "translate(-140%, 0) rotate(-18deg)";
  const topStyle =
    flying && top && flying.id === top.id
      ? { transform: flyTransform(flying.verdict), transition: `transform ${FLY_MS}ms ease-in` }
      : drag
        ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` }
        : { transform: "none", transition: "transform 180ms ease-out" };
  const hint = drag ? (drag.x > 40 ? "like" : drag.x < -40 ? "nope" : null) : (flying?.verdict ?? null);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-2" : "gap-3")} data-swipe-deck={compact ? "start" : "page"}>
      {!compact && (
        <div className="flex justify-end">
          <FilterButton />
        </div>
      )}

      {/* The card takes what the screen has left – no scrolling. */}
      <div className={cn("relative flex-1", compact ? "min-h-[240px]" : "min-h-[300px]")}>
        {/* A stack: the cards behind peek out, the next one slides forward. */}
        {afterNext && (
          <div aria-hidden="true" className="absolute inset-0 translate-y-5 scale-[0.92] opacity-50 transition-transform duration-200">
            <Card card={afterNext} partnerName={partnerName} compact={compact} />
          </div>
        )}
        {next && (
          <div aria-hidden="true" className={cn("absolute inset-0 translate-y-2.5 scale-[0.96] opacity-80 transition-transform duration-200", flying && "translate-y-0 scale-100 opacity-100")}>
            <Card card={next} partnerName={partnerName} compact={compact} />
          </div>
        )}
        {top ? (
          <div
            key={top.id}
            ref={topEl}
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
            <Card card={top} partnerName={partnerName} compact={compact} />
            {hint && (
              <span
                aria-hidden="true"
                className={cn(
                  "sticker absolute top-6 rounded-2xl px-4 py-1.5 font-display text-2xl font-bold text-tinte",
                  hint === "like" && "left-6 -rotate-12 bg-minze",
                  hint === "nope" && "right-6 rotate-12 bg-himbeere",
                )}
              >
                {hint === "like" ? "💚 Gerne!" : "✕ Nö"}
              </span>
            )}
          </div>
        ) : (
          <div className={cn("flex h-full flex-col items-center justify-center rounded-[28px] border-[2.5px] border-dashed border-line px-6 text-center", compact ? "gap-2" : "gap-4")}>
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
                  {filtered ? "🔍" : "🎉"}
                </span>
                <p className="font-display text-xl font-semibold">{filtered ? "Gerade nichts Passendes" : "Alles durchgeswipt!"}</p>
                {ai ? (
                  <Button onClick={more} disabled={loading}>
                    {filtered ? `✨ Mehr „${filterSummary(filter)}“ holen` : "✨ Neue Ideen holen"}
                  </Button>
                ) : (
                  <p className="text-sm font-bold text-muted">Neue Karten macht die KI – sie ist noch nicht eingerichtet.</p>
                )}
              </>
            )}
          </div>
        )}

        {compact && top && (
          <>
            <span className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
              <Link href="/ideas/entdecken" aria-label={`Alle ${cards.length} Karten`} className="rounded-full border-2 border-line bg-surface px-2.5 py-0.5 text-[13px] font-extrabold text-ink">
                {cards.length} ›
              </Link>
              <Info term="swipen" className="bg-surface text-ink" />
            </span>
            {message && (
              <p role="status" className="absolute inset-x-6 bottom-[4.4rem] z-10 rounded-full border-2 border-line bg-surface px-3 py-1 text-center text-sm font-extrabold text-ink">
                {message}
              </p>
            )}
            <div className="absolute inset-x-0 bottom-3 z-10 flex items-center justify-center gap-4">
              <button type="button" aria-label="Nein" onClick={() => decide("nope")} disabled={undoing} className="sticker press flex size-12 items-center justify-center rounded-full bg-himbeere text-xl text-tinte disabled:opacity-40">
                ✕
              </button>
              <button type="button" aria-label="Rückgängig" onClick={undo} disabled={busy || undoing} className="sticker press flex size-9 items-center justify-center rounded-full bg-surface text-base text-ink disabled:opacity-40">
                ↩️
              </button>
              <button type="button" aria-label="Gefällt mir" onClick={() => decide("like")} disabled={undoing} className="sticker press flex size-12 items-center justify-center rounded-full bg-minze text-xl text-tinte disabled:opacity-40">
                💚
              </button>
            </div>
          </>
        )}
      </div>

      {/* Start page: counter, toast and buttons sit on the card itself. */}
      {!compact && (
        <>
          <div className="flex items-center justify-center gap-4">
            <button type="button" aria-label="Nein" onClick={() => decide("nope")} disabled={!top || undoing} className="sticker press flex size-16 items-center justify-center rounded-full bg-himbeere text-2xl text-tinte disabled:opacity-40">
              ✕
            </button>
            <button type="button" aria-label="Rückgängig" onClick={undo} disabled={busy || undoing} className="sticker press flex size-12 items-center justify-center rounded-full bg-surface text-xl text-ink disabled:opacity-40">
              ↩️
            </button>
            <button type="button" aria-label="Gefällt mir" onClick={() => decide("like")} disabled={!top || undoing} className="sticker press flex size-16 items-center justify-center rounded-full bg-minze text-2xl text-tinte disabled:opacity-40">
              💚
            </button>
          </div>
          <p role="status" className="min-h-5 text-center text-sm font-bold text-muted">
            {message ?? (top ? `${cards.length} ${cards.length === 1 ? "Karte" : "Karten"} · 💚 kommt auf die Wunschliste, beide 💚 = Match` : "")}
          </p>
        </>
      )}

      {!compact && top && ai && cards.length < 8 && !generating && (
        <button type="button" onClick={more} disabled={loading} className="self-center text-sm font-extrabold text-muted underline disabled:opacity-60">
          {loading ? "Mische neue Ideen …" : filtered ? `✨ Mehr „${filterSummary(filter)}“ holen` : "✨ Mehr Ideen holen"}
        </button>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-extrabold">
          {stats.swiped > 0 && (
            <span data-swipe-progress className="rounded-full bg-surface px-3 py-0.5 text-ink">
              {stats.swiped} geswipt · {stats.liked} 💚 · {cards.length} übrig
            </span>
          )}
          <Link href="/ideas?ansicht=geswipt" className="underline">
            💚 Meine Likes
          </Link>
          {matches > 0 && (
            <Link href="/ideas?ansicht=match" className="underline">
              💞 {matches} {matches === 1 ? "Match" : "Matches"}
            </Link>
          )}
        </div>
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
