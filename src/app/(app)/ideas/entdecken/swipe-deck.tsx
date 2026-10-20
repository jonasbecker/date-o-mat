"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { Bloom } from "@/components/bloom";
import { Button, buttonClass } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { flyToWishlist } from "@/components/fly-to-wishlist";
import { Mascot } from "@/components/mascot";
import { CloseIcon, UndoIcon } from "@/components/icons";
import type { AvatarPerson } from "@/components/avatar";
import { WISHLIST_ADDED_EVENT } from "@/components/wishlist-badge";
import { DECK_THEMES, matchesFilter, type DeckCardView } from "@/core/deck";
import { activeFilterCount, filterSummary } from "@/core/filters";
import { useIdeaFilter } from "@/components/idea-filter";
import { cn } from "@/lib/cn";
import { formatCost } from "@/lib/idea-input";
import { moreCardsAction, swipeAction, undoSwipeAction } from "./actions";

type Verdict = "like" | "nope";

const THRESHOLD_X = 100;
const FLY_MS = 220;

const THEME_LABEL = Object.fromEntries(DECK_THEMES.map((t) => [t.key, t.label])) as Record<string, string>;
// The picture area of a card: a pastel tile with two soft shapes (DESIGN.md §2) – fixed light
// tones, so they stay the same in dark mode.
const TILES = [
  { bg: "#DCE7F5", shape: "#9DB8E3" },
  { bg: "#F7EBC4", shape: "#E3C76E" },
  { bg: "#E6E0F2", shape: "#B7A7DE" },
  { bg: "#F6DFD3", shape: "#E8A58D" },
  { bg: "#DCEBD9", shape: "#8FC79A" },
];
const THEME_TILE: Record<string, number> = { food: 1, nature: 4, culture: 2, active: 0, creative: 1, cozy: 3, new: 2, free: 4, romantic: 3, trip: 0, learn: 1, night: 2 };

function tileFor(card: DeckCardView) {
  if (card.theme && card.theme in THEME_TILE) return TILES[THEME_TILE[card.theme]];
  let h = 0;
  for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILES[h % TILES.length];
}

function sourceOf(card: DeckCardView): string {
  if (card.kind === "combo") return "Event";
  if (card.kind === "revisit") return "Eure Liste";
  return card.location && /köln/i.test(card.location) ? "Köln" : "Vorschlag";
}

/** KEIMZEIT on the packet: how long the date takes. */
const KEIMZEIT = { small: "1 Abend", large: "halber Tag" } as const;
const BEET_FALLBACK = { indoor: "drinnen", outdoor: "draußen" } as const;
// The packet's top edge: 20 teeth of 10 px (ThSwipe.html).
const ZIGZAG = `polygon(${Array.from({ length: 21 }, (_, i) => `${i * 5}% ${i % 2 === 0 ? "10px" : "0"}`).join(", ")}, 100% 100%, 0 100%)`;

/** One idea as a seed packet (ThSwipe.html): "Saatgut für zwei", picture field with the sort, title, text, Keimzeit · Beet · Kosten. */
function Card({ card, partnerName, pos }: { card: DeckCardView; partnerName: string; pos?: string }) {
  const tile = tileFor(card);
  const sorte = card.theme && THEME_LABEL[card.theme] ? THEME_LABEL[card.theme] : sourceOf(card);
  return (
    <div className="relative h-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]">
      <div aria-hidden="true" className="absolute inset-0 rounded-b-[18px] bg-butter" style={{ clipPath: ZIGZAG }} />
      <div className="relative flex h-full flex-col text-[#1B2620]">
        <div className="flex justify-between px-[18px] pb-2 pt-5 font-mono text-[10px] tracking-[0.08em]">
          <span>SAATGUT FÜR ZWEI</span>
          {pos && <span>Nº {pos}</span>}
        </div>
        <div className="relative mx-3.5 h-[190px] min-h-[44px] shrink overflow-hidden rounded-[14px]" style={{ background: tile.bg }}>
          <span aria-hidden="true" className="absolute left-[70px] top-10 h-[90px] w-[150px] -rotate-[18deg] rounded-[50%]" style={{ background: tile.shape }} />
          <span aria-hidden="true" className="absolute left-[190px] top-[112px] h-[42px] w-[74px] rounded-[50%] opacity-60" style={{ background: tile.shape }} />
          {card.emoji && (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl">
              {card.emoji}
            </span>
          )}
          <span className="absolute bottom-3 left-3 inline-flex h-[26px] items-center rounded-full bg-white/85 px-2.5 font-mono text-[10px]">Sorte: {sorte}</span>
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-[18px] pt-3.5">
          {(card.partnerSuper || card.kind === "revisit" || card.wildcard) && (
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
              {card.partnerSuper && <span className="rounded-full bg-tile-rose px-2.5 py-1 text-partner-ink">★ {partnerName} findet das super</span>}
              {card.kind === "revisit" && <span className="rounded-full bg-tile-lilac px-2.5 py-1">🕰️ Liegt {card.waitingSince ?? "lange"} im Regal</span>}
              {card.wildcard && <span className="rounded-full bg-tile-lilac px-2.5 py-1">Mal was anderes</span>}
            </div>
          )}
          <h2 className="line-clamp-2 text-[27px] font-extrabold leading-none tracking-[-0.035em]">{card.title}</h2>
          {card.note && <p className="line-clamp-3 text-sm leading-[1.35] [@media(max-height:700px)]:line-clamp-1 text-[#4A5547]">{card.note}</p>}
          {card.event && (
            <div className="shrink-0 rounded-2xl bg-white/60 px-3 py-2 text-[13px]">
              <p className="font-bold">🎟️ {card.event.title}</p>
              <p className="text-[#4A5547]">
                {card.event.when}
                {card.event.venue ? ` · ${card.event.venue}` : ""}
              </p>
              {card.bothFree === true && <p className="mt-0.5">✓ Ihr habt beide Zeit</p>}
              {card.bothFree === false && <p className="mt-0.5">✗ Da hat jemand von euch schon was vor</p>}
            </div>
          )}
        </div>
        <div className="mt-auto grid shrink-0 grid-cols-3 border-t-[1.5px] border-dashed border-[#C9C2A0] px-[18px] pb-3.5 pt-2.5 font-mono text-[10px] text-[#4A5547]">
          <span>
            KEIMZEIT
            <br />
            <b className="text-[#1B2620]">{KEIMZEIT[card.size]}</b>
          </span>
          <span className="min-w-0">
            BEET
            <br />
            <b className="block truncate text-[#1B2620]">{card.location ?? (card.setting ? BEET_FALLBACK[card.setting] : "offen")}</b>
          </span>
          <span>
            KOSTEN
            <br />
            <b className="text-[#1B2620]">{formatCost(card.costEur) ?? "?"}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SwipeDeck({
  cards: serverCards,
  generating,
  ai,
  partnerName,
  people,
}: {
  cards: DeckCardView[];
  generating: boolean;
  ai: boolean;
  partnerName: string;
  /** Me and the partner – their avatars on the match screen. */
  people: [AvatarPerson, AvatarPerson];
}) {
  const celebrate = useCelebrate();
  // Swiped here (hidden at once), and cards brought back with ↩️ (shown first).
  const [handled, setHandled] = useState<Set<string>>(() => new Set());
  const [restored, setRestored] = useState<DeckCardView[]>([]);
  const [filter, setFilter] = useIdeaFilter();
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
  // The mini flower reacts to your last choice.
  const [lastVerdict, setLastVerdict] = useState<Verdict | null>(null);
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
  // "3 / 12": how far this visit got.
  const position = stats.swiped + 1;

  function decide(verdict: Verdict) {
    if (!top || flying || undoing) return;
    const card = top;
    setMessage(null);
    verdicts.current.push(verdict);
    setLastVerdict(verdict);
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
        if (result.saved) setMessage(`Steht auf eurer Wunschliste ♥ Will ${partnerName} auch, ist's ein Match.`);
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
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    // Only sideways counts: a mostly vertical move lets go (the page stays calm), the card never leaves its row.
    if (!drag && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      start.current = null;
      return;
    }
    setDrag({ x: dx, y: 0 });
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
        ? { transform: `translate(${drag.x}px, 0) rotate(${drag.x / 22}deg)` }
        : { transform: "none", transition: "transform 180ms ease-out" };
  const hint = drag ? (drag.x > 40 ? "like" : drag.x < -40 ? "nope" : null) : (flying?.verdict ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-swipe-deck="page">
      {/* The card takes what the screen has left – no scrolling. A stack: the next one peeks out, tilted. */}
      <div className="relative mx-1 min-h-[250px] flex-1">
        {next && (
          <div aria-hidden="true" className={cn("absolute inset-x-3.5 bottom-0 top-2 rotate-[5deg] transition-transform duration-200", flying && "inset-x-0 top-0 rotate-[-2deg]")}>
            <div className="h-full rounded-2xl bg-[#2A3830]" />
          </div>
        )}
        {top ? (
          <div
            key={top.id}
            ref={topEl}
            role="group"
            aria-roledescription="Karte"
            aria-label={top.title}
            className="absolute inset-0 -rotate-2 cursor-grab touch-pan-y select-none active:cursor-grabbing"
            style={topStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              start.current = null;
              setDrag(null);
            }}
          >
            <Card card={top} partnerName={partnerName} pos={`${position} / ${position + cards.length - 1}`} />
            {hint && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-16 rounded-full px-4 py-1.5 text-2xl font-extrabold tracking-[-0.03em]",
                  hint === "like" && "left-6 -rotate-12 bg-like text-white",
                  hint === "nope" && "right-6 rotate-12 bg-ink text-bg shadow-md",
                )}
              >
                {hint === "like" ? "♥ einpflanzen" : "✕ kompost"}
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[22px] border-[1.5px] border-dashed border-line px-6 text-center">
            {generating || loading ? (
              <>
                <Mascot id="deck" size={72} busy />
                <p className="text-xl font-bold">Neue Ideen werden gemischt …</p>
                <p className="text-sm text-muted">Dauert etwa eine halbe Minute.</p>
              </>
            ) : (
              <>
                <span className="text-5xl" aria-hidden="true">
                  {filtered ? "🔍" : "🎉"}
                </span>
                <p className="text-xl font-bold">{filtered ? "Gerade keine passenden Samen" : "Alle Tüten durchgeswipt!"}</p>
                {ai ? (
                  <Button onClick={more} disabled={loading}>
                    {filtered ? `✨ Mehr „${filterSummary(filter)}“ holen` : "✨ Neue Samen holen"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted">Neue Karten macht die KI – sie ist noch nicht eingerichtet.</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ✕ kompost · ♥ einpflanzen; the mini flower bottom left comments on it (ThSwipe.html). */}
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-2 -left-3.5 h-[110px] w-[78px] overflow-hidden">
          <Bloom stimmung={lastVerdict === "like" ? "froh" : "wartet"} blaetter={2} className="h-[110px] w-[78px]" />
        </div>
        <div className="flex items-start justify-center gap-[26px]">
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              aria-label="Auf den Kompost"
              onClick={() => decide("nope")}
              disabled={!top || undoing}
              className="press flex size-16 items-center justify-center rounded-full bg-ink text-bg disabled:opacity-40"
            >
              <CloseIcon width={24} height={24} />
            </button>
            <span className="font-mono text-[10px] text-muted">kompost</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              aria-label="Einpflanzen"
              onClick={() => decide("like")}
              disabled={!top || undoing}
              className="press flex size-[76px] items-center justify-center rounded-full bg-like text-white shadow-[0_0_26px_rgba(229,143,166,0.45)] disabled:opacity-40"
            >
              <HeartFill width={30} height={30} />
            </button>
            <span className="font-mono text-[10px] text-muted">einpflanzen</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Rückgängig"
          onClick={undo}
          disabled={busy || undoing}
          className="press absolute right-0 top-2.5 flex size-11 items-center justify-center rounded-full bg-surface text-muted disabled:opacity-40"
        >
          <UndoIcon width={18} height={18} />
        </button>
      </div>
      <p role="status" className="min-h-6 pl-[72px] font-hand text-[19px] font-semibold leading-tight text-butter -rotate-3">
        {message ?? (top ? (lastVerdict === "like" ? "← die gefällt mir auch!" : "← na, was meinst du?") : "")}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] font-semibold">
        {stats.swiped > 0 && (
          <span data-swipe-progress className="meta rounded-full bg-surface px-3 py-1 text-ink">
            {stats.swiped} geswipt · {stats.liked} ♥ · {cards.length} übrig
          </span>
        )}
        <Link href="/ideas?ansicht=geswipt" className="text-muted underline">
          Meine Likes
        </Link>
        {top && ai && cards.length < 8 && !generating && (
          <button type="button" onClick={more} disabled={loading} className="text-muted underline disabled:opacity-60">
            {loading ? "Mische neue Ideen …" : filtered ? `Mehr „${filterSummary(filter)}“` : "Mehr Ideen"}
          </button>
        )}
      </div>

      {match && (
        // "keimt!" (ThSwipe.html): you both want it – a seedling comes up.
        <div role="dialog" aria-modal="true" aria-labelledby="match-title" className="animate-pop-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-3.5 bg-[rgba(17,26,20,0.95)] px-7 text-center text-ink">
          <div aria-hidden="true" className="relative size-[120px]">
            <span className="absolute left-[58px] top-10 h-[60px] w-[5px] rounded-[3px] bg-[#4FA25E]" />
            <span className="absolute left-[62px] top-10 h-6 w-11 origin-left -rotate-[30deg] rounded-[50%] bg-[#6DBA74]" />
            <span className="absolute left-3.5 top-[52px] h-6 w-11 origin-right rotate-[30deg] rounded-[50%] bg-[#4FA25E]" />
            <span className="absolute left-5 top-[98px] h-3.5 w-20 rounded-[7px] bg-[#6B4A33]" />
          </div>
          <h2 id="match-title" className="text-[68px] font-extrabold leading-[0.9] tracking-[-0.05em]">
            keimt!
          </h2>
          <p className="text-[17px] leading-snug text-text-soft">
            Ihr wollt beide:
            <br />
            <b className="text-ink">{match.title}</b>
          </p>
          <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
            <Link href={`/plan?idea=${match.ideaId}`} className={buttonClass("primary", "lg", "w-full")}>
              Direkt planen
            </Link>
            <button type="button" onClick={() => setMatch(null)} className="press h-[52px] rounded-full border-2 border-ink text-base font-bold">
              Weiter swipen
            </button>
          </div>
          <span className="sr-only">
            {people[0].name} und {people[1].name}
          </span>
        </div>
      )}
    </div>
  );
}


function HeartFill(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
