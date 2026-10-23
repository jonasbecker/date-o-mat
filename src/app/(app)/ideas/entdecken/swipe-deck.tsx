"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { Bloom } from "@/components/bloom";
import { Button, buttonClass } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { flyToWishlist } from "@/components/fly-to-wishlist";
import { Mascot } from "@/components/mascot";
import type { AvatarPerson } from "@/components/avatar";
import { WISHLIST_ADDED_EVENT } from "@/components/wishlist-badge";
import { pickQuip } from "@/core/pick-quip";
import type { DeckCardView } from "@/core/deck";
import { matchesFilter } from "@/core/deck-filter";
import { activeFilterCount, filterSummary } from "@/core/filters";
import { useIdeaFilter } from "@/components/idea-filter";
import { moreCardsAction, swipeAction, undoSwipeAction } from "./actions";
import { useShareDeck } from "./deck-chrome";
import { Card, Stamp, type Verdict } from "./swipe-card";
import { queuedSwipes, queueSwipe, SWIPE_SENT_EVENT, unqueueSwipe, type SwipeSent } from "./swipe-queue";

/** How far (share of the card's width) a swipe has to go – the stamp shows from here on. */
const THRESHOLD = 0.3;
/** The next card waits right behind, a little smaller and lower (it peeks out at the bottom). */
const BEHIND = { y: 22, scale: 0.95 };
const behindTransform = (p: number) => `translate3d(0, ${(BEHIND.y * (1 - p)).toFixed(1)}px, 0) scale(${(BEHIND.scale + (1 - BEHIND.scale) * p).toFixed(4)})`;
const FLY_MS = 220;
/** The flower is sad (or happy) for a moment, then waits again. */
const REACTION_MS = 1600;
/** A note in the flower's bubble stays this long. */
const MESSAGE_MS = 4000;
/** Tapped, the flower tells how far you two are – this long. */
const STATUS_MS = 5000;
/** Left alone, the flower says something else about the top card this often. */
const QUIP_MS = 10_000;

const QUIP_CLASS = "min-h-9 max-w-[250px] -rotate-2 justify-self-start rounded-[18px_18px_18px_4px] bg-butter px-3.5 pb-[11px] pt-[9px] font-hand text-xl font-semibold leading-[1.02] text-[#2B1D12]";

export function SwipeDeck({
  cards: serverCards,
  generating,
  ai,
  partnerName,
  partnerSwiped,
  people,
}: {
  cards: DeckCardView[];
  generating: boolean;
  ai: boolean;
  partnerName: string;
  /** How many cards the partner has swiped – the flower says it when tapped. */
  partnerSwiped: number;
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
  useEffect(() => {
    if (!match) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMatch(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [match]);
  // What went wrong or what a swipe changed – the flower says it in its bubble (no text under the card).
  const [message, setMessageState] = useState<string | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setMessage(text: string | null) {
    setMessageState(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    if (text) messageTimer.current = setTimeout(() => setMessageState(null), MESSAGE_MS);
  }
  // The finger moves the card straight in the DOM (no render per move – that stuttered on phones); React only
  // hears when a drag starts and when the stamp changes.
  const dragX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStamp, setDragStamp] = useState<Verdict | null>(null);
  const frame = useRef<number | null>(null);
  function endDrag(springBack: boolean) {
    dragX.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    const el = topEl.current;
    if (springBack && el) {
      el.style.transition = "transform 180ms ease-out";
      el.style.transform = "none";
    }
    const behind = nextEl.current;
    if (springBack && behind) {
      behind.style.transition = "transform 180ms ease-out";
      behind.style.transform = behindTransform(0);
    }
    setDragging(false);
    setDragStamp(null);
  }
  const [flying, setFlying] = useState<{ id: string; verdict: Verdict } | null>(null);
  const [busy, startBusy] = useTransition();
  // While an undo is on its way, the top card is about to change – no swiping.
  const [undoing, startUndo] = useTransition();
  const [loading, startLoading] = useTransition();
  const start = useRef<{ x: number; y: number } | null>(null);
  // Tapped (not dragged), the card opens to the full screen – description, event, map – and closes again.
  const [full, setFull] = useState(false);
  const tap = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const topEl = useRef<HTMLDivElement | null>(null);
  const nextEl = useRef<HTMLDivElement | null>(null);
  // What this visit has done so far – the deck shows its progress.
  const [stats, setStats] = useState({ swiped: 0, liked: 0 });
  // The flower reacts to your last choice for a moment (happy / sad), then waits again.
  const [reaction, setReaction] = useState<{ verdict: Verdict; quip: string } | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Left alone, the flower moves on to the next quip about the top card every few seconds.
  const [quipTurn, setQuipTurn] = useState(0);
  // Tapped, it tells how far you two are (and leads to my likes) for a moment.
  const [status, setStatus] = useState(false);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showStatus() {
    setStatus(true);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(false), STATUS_MS);
  }
  const width = useRef(320);
  const verdicts = useRef<Verdict[]>([]);
  // The last swipe kept on the phone (no network): ↺ takes it back right here.
  const lastQueued = useRef<DeckCardView | null>(null);
  // Swipes kept from before stay off the deck until they are sent (a reload offline shows the old cards).
  useEffect(() => {
    const kept = queuedSwipes();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only there after mount
    if (kept.length > 0) setHandled((prev) => new Set([...prev, ...kept.map((q) => q.cardId)]));
  }, []);
  // Sent later (SwipeQueueFlusher): a match is celebrated now, the flower says they arrived.
  useEffect(() => {
    const onSent = (e: Event) => {
      const { result } = (e as CustomEvent<SwipeSent>).detail;
      if (result.ok && result.match) {
        celebrate();
        setMatch(result.match);
      } else setMessage("deine offline-swipes sind angekommen 💌");
    };
    window.addEventListener(SWIPE_SENT_EVENT, onSent);
    return () => window.removeEventListener(SWIPE_SENT_EVENT, onSent);
  }, [celebrate]);
  // The fly-out of the last swipe; an undo right after must not be overtaken by it.
  const flyTimer = useRef<{ timer: ReturnType<typeof setTimeout>; id: string } | null>(null);

  const seen = new Set<string>();
  const all = [...restored, ...serverCards].filter((c) => {
    if (seen.has(c.id) || handled.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const sorted = all.filter((c) => matchesFilter(c, filter));
  const shownWhen = useRef(new Map<string, DeckCardView["when"]>());
  for (const c of serverCards) if (c.when) shownWhen.current.set(c.id, c.when);
  // The card on top stays on top until it is swiped: a refresh re-sorts the deck (the partner's likes
  // come first), and a new card must never slide in under your finger. Gone from the server meanwhile
  // (the partner noped it) – it still stays; swiping it says so.
  const [pinned, setPinned] = useState<DeckCardView | null>(null);
  const keep = pinned && !handled.has(pinned.id) && matchesFilter(pinned, filter) ? (sorted.find((c) => c.id === pinned.id) ?? pinned) : null;
  const cards = keep ? [keep, ...sorted.filter((c) => c.id !== keep.id)] : sorted;
  const top = cards[0];
  const next = cards[1];
  // Remembered while rendering (React's "adjust state on change"), so the very next refresh sees it.
  if (top && top.id !== pinned?.id) setPinned(top);
  // Nothing left to show full.
  if (!top && full) setFull(false);
  const canUndo = stats.swiped > 0 && !busy && !undoing;

  function decide(verdict: Verdict) {
    if (!top || flying || undoing) return;
    const card = top;
    // The swipe did not count (offline, or the card was gone): the count and ↺ forget it again.
    const forget = () => {
      const i = verdicts.current.lastIndexOf(verdict);
      if (i >= 0) verdicts.current.splice(i, 1);
      setStats((s) => ({ swiped: Math.max(0, s.swiped - 1), liked: Math.max(0, s.liked - (verdict === "like" ? 1 : 0)) }));
    };
    setMessage(null);
    verdicts.current.push(verdict);
    const quips = verdict === "like" ? card.art.quips.like : card.art.quips.nope;
    setReaction({ verdict, quip: pickQuip(quips, card.id) });
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), REACTION_MS);
    setQuipTurn(0);
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
    endDrag(false);
    flyTimer.current = { id: card.id, timer: setTimeout(() => landed(card.id), FLY_MS) };
    startBusy(async () => {
      const result = await swipeAction(card.id, verdict).catch(() => null);
      if (!result) {
        // No network: the swipe is kept on the phone and sent once there is network again (swipe-queue.ts).
        queueSwipe({ cardId: card.id, verdict });
        lastQueued.current = card;
        setMessage("kein netz – ich merk's mir und schick's nach.");
        return;
      }
      lastQueued.current = null;
      if (!result.ok) {
        forget();
        setMessage(`die ist schon weg – ${partnerName.toLowerCase()} war schneller.`);
        return;
      }
      if (result.ok && result.match) {
        celebrate();
        setMatch(result.match);
      } else if (result.ok) {
        const notes: Partial<Record<string, string>> = {
          keep: "bleibt auf eurer liste 💚",
          archive: "von der liste – ihr wart euch einig.",
        };
        // A new idea on the wishlist (not one the other already put there): the 💡 counts up.
        if (result.saved) window.dispatchEvent(new Event(WISHLIST_ADDED_EVENT));
        // A plain like needs no words: the flower's like quip says it (the ⓘ explains the wishlist).
        if (notes[result.outcome]) setMessage(notes[result.outcome]!);
        else if (card.kind === "revisit" && verdict === "nope") setMessage(`sagt ${partnerName.toLowerCase()} auch nein, fliegt sie raus.`);
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
    // The last swipe never left the phone: taken back right here.
    const kept = lastQueued.current;
    if (kept && unqueueSwipe(kept.id)) {
      lastQueued.current = null;
      const undone = verdicts.current.pop();
      if (undone) setStats((s) => ({ swiped: Math.max(0, s.swiped - 1), liked: Math.max(0, s.liked - (undone === "like" ? 1 : 0)) }));
      setHandled((prev) => {
        const copy = new Set(prev);
        copy.delete(kept.id);
        return copy;
      });
      setRestored((prev) => [kept, ...prev.filter((c) => c.id !== kept.id)]);
      setPinned(kept);
      return;
    }
    startUndo(async () => {
      const result = await undoSwipeAction().catch(() => null);
      if (!result) return setMessage("hoppla – bist du offline?");
      if (!result.ok) {
        setMessage("da gibt's nix mehr zurück.");
        return;
      }
      if (result.kept) setMessage("die idee bleibt auf eurer liste – nur dein like ist weg.");
      // The undo answer has no day on it – the card had one when it was shown.
      const card = { ...result.card, when: result.card.when ?? shownWhen.current.get(result.card.id) ?? null };
      const undone = verdicts.current.pop();
      if (undone) setStats((s) => ({ swiped: Math.max(0, s.swiped - 1), liked: Math.max(0, s.liked - (undone === "like" ? 1 : 0)) }));
      setHandled((prev) => {
        const copy = new Set(prev);
        copy.delete(card.id);
        return copy;
      });
      setRestored((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
      setPinned(card);
      if (!matchesFilter(card, filter)) setFilter({});
    });
  }

  function more() {
    setMessage(null);
    startLoading(async () => {
      const result = await moreCardsAction(filter).catch(() => null);
      if (!result) return setMessage("hoppla – bist du offline?");
      if (result.message) setMessage(result.message);
    });
  }

  // Keyboard: ← nope, → like, Backspace undo.
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (event: KeyboardEvent) => {
      // Not while typing, while "keimt!" or a sheet (Filter, ⓘ) is open – the card is behind it.
      if (match || document.querySelector("dialog[open]") || (event.target as HTMLElement | null)?.closest("input, textarea, select, dialog")) return;
      if (event.key === "Escape" && full) setFull(false);
      else if (event.key === "ArrowLeft") decide("nope");
      else if (event.key === "ArrowRight") decide("like");
      // Like ↺: only what this visit swiped (not a like from days ago).
      else if (event.key === "Backspace" && canUndo) undo();
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
    // A tap on a link or the map does what it says – it does not open or close the card.
    tap.current = { x: event.clientX, y: event.clientY, on: !(event.target as Element).closest("a, button") };
    width.current = event.currentTarget.getBoundingClientRect().width || 320;
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (tap.current && Math.hypot(dx, dy) > 6) tap.current = null;
    // Only sideways counts: a mostly vertical move lets go (the page stays calm), the card never leaves its row.
    if (dragX.current === null && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      start.current = null;
      return;
    }
    // Captured only once it is a drag: a tap on a button inside (✕, "ganzer Text", Kompost / Einpflanzen) stays its click.
    if (dragX.current === null) {
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    dragX.current = dx;
    const threshold = width.current * THRESHOLD;
    setDragStamp(dx > threshold ? "like" : dx < -threshold ? "nope" : null);
    // One style write per frame, on the compositor (transform only).
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const el = topEl.current;
        const x = dragX.current;
        if (!el || x === null) return;
        el.style.transition = "none";
        el.style.transform = `translate3d(${x}px, 0, 0) rotate(${Math.max(-9, Math.min(9, (x / width.current) * 18))}deg)`;
        // The card behind comes forward as this one goes – it is all there by the time the swipe counts.
        const behind = nextEl.current;
        if (behind) {
          behind.style.transition = "none";
          behind.style.transform = behindTransform(Math.min(1, Math.abs(x) / (width.current * THRESHOLD)));
        }
      });
    }
  }
  function onPointerUp() {
    const x = dragX.current;
    const tapped = tap.current?.on && (x === null || Math.abs(x) <= 6);
    tap.current = null;
    start.current = null;
    if (tapped) {
      if (x !== null) endDrag(true);
      setFull((f) => !f);
      return;
    }
    if (x === null) return;
    const threshold = width.current * THRESHOLD;
    if (x > threshold) decide("like");
    else if (x < -threshold) decide("nope");
    else endDrag(true);
  }

  // The full card's ✕ and its bar: stable callbacks, so the memoized card does not render with every drag frame.
  const decideRef = useRef(decide);
  useLayoutEffect(() => {
    decideRef.current = decide;
  });
  const onDecide = useCallback((verdict: Verdict) => decideRef.current(verdict), []);
  const onClose = useCallback(() => setFull(false), []);
  // "Nº 5 / 74": this visit's swipes plus what is left.
  const total = stats.swiped + cards.length;

  useShareDeck({ swiped: stats.swiped, left: cards.length, canUndo, undo, more: ai ? more : null, loading });

  const flyTransform = (verdict: Verdict) =>
    verdict === "like"
      ? "translate(140%, 0) rotate(18deg)"
      : "translate(-140%, 0) rotate(-18deg)";
  const topStyle =
    flying && top && flying.id === top.id
      ? { transform: flyTransform(flying.verdict), transition: `transform ${FLY_MS}ms ease-in` }
      : { transform: "none", transition: "transform 180ms ease-out" };
  const nextStyle = flying ? { transform: behindTransform(1), transition: `transform ${FLY_MS}ms ease-out` } : { transform: behindTransform(0), transition: "transform 180ms ease-out" };
  const stamp = dragging ? dragStamp : (flying?.verdict ?? null);
  // What the flower says: its reaction, or about the top card (another one with every tap).
  const quip = message ?? reaction?.quip ?? (top ? pickQuip(top.art.quips.neutral, top.id, quipTurn) : "");
  const idle = !message && !reaction && !status && !!top;
  useEffect(() => {
    if (!idle) return;
    const timer = setInterval(() => setQuipTurn((n) => n + 1), QUIP_MS);
    return () => clearInterval(timer);
  }, [idle]);
  const swipedWords = partnerSwiped > 0 ? `${partnerName.toLowerCase()} hat ${partnerSwiped} geswipt.` : `${partnerName.toLowerCase()} hat noch nix geswipt.`;
  const mood = reaction ? (reaction.verdict === "like" ? "froh" : "traurig") : "wartet";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-swipe-deck="page" data-full={full ? "" : undefined}>
      {/* The card takes what the screen has left – no scrolling. A stack: the real next card waits behind (it peeks out
          at the bottom and comes forward while this one is swiped away – never an empty card). Both are one keyed list,
          so the card behind is the very same element once it is on top (no new map, no flash). */}
      <div className="relative min-h-[280px] flex-1">
        {[top, next].map((c, i) =>
          !c ? null : i === 1 ? (
            <div key={c.id} ref={nextEl} aria-hidden="true" inert data-next-card className="pointer-events-none absolute inset-0 z-[1] origin-center" style={nextStyle}>
              <Card card={c} partnerName={partnerName} full={full} nr={stats.swiped + 2} total={total} />
            </div>
          ) : (
          <div
            key={c.id}
            ref={topEl}
            role="group"
            aria-roledescription="Karte"
            aria-label={c.title}
            className="absolute inset-0 z-[2] origin-bottom cursor-grab touch-pan-y select-none active:cursor-grabbing"
            style={topStyle}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              start.current = null;
              tap.current = null;
              endDrag(true);
            }}
          >
            <Card card={c} partnerName={partnerName} full={full} nr={stats.swiped + 1} total={total} onClose={onClose} onDecide={onDecide} />
            {stamp && <Stamp verdict={stamp} />}
            {/* Swiping only – for the keyboard and screen readers the two choices stay as buttons, seen when focused. */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {(["nope", "like"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-label={v === "like" ? "Einpflanzen" : "Auf den Kompost"}
                  onClick={() => decide(v)}
                  disabled={undoing}
                  className="sr-only whitespace-nowrap rounded-full bg-[#1B2620] text-sm font-bold text-[#E7EEDF] focus-visible:not-sr-only focus-visible:px-4 focus-visible:py-2"
                >
                  {v === "like" ? "einpflanzen →" : "← kompost"}
                </button>
              ))}
              <button
                type="button"
                aria-expanded={full}
                onClick={() => setFull((f) => !f)}
                className="sr-only whitespace-nowrap rounded-full bg-[#1B2620] text-sm font-bold text-[#E7EEDF] focus-visible:not-sr-only focus-visible:px-4 focus-visible:py-2"
              >
                {full ? "Kleiner" : "Alles zeigen"}
              </button>
            </div>
          </div>
          ),
        )}
        {!top && (
          <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] border-[1.5px] border-dashed border-line px-6 text-center">
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
                <p className="text-xl font-bold">{filtered ? "Gerade keine passenden Samen" : "Alles durchgeswipt!"}</p>
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

      {/* Under the card only the flower (tap: how far you two are) and its bubble – ⓘ and ↺ sit at the top. The card
          open to the full screen pushes them down and away. */}
      <div data-deck-fold="down" className="shrink-0">
      <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-2">
        <button
          type="button"
          onClick={showStatus}
          aria-label="Blume antippen: wie weit seid ihr?"
          className="relative h-[106px] w-[76px] overflow-hidden [@media(max-height:700px)]:h-[84px]"
        >
          <Bloom stimmung={mood} blaetter={2} className="absolute -left-1 top-0 h-[106px] w-[76px] [@media(max-height:700px)]:h-[84px]" />
        </button>
        {status && !message && !reaction ? (
          <p data-quip data-deck-status aria-live="polite" className={QUIP_CLASS}>
            {swipedWords}{" "}
            <Link href="/ideas?ansicht=geswipt" className="underline">
              deine likes ›
            </Link>
          </p>
        ) : (
          <p data-quip aria-live="polite" className={QUIP_CLASS}>
            {quip || "na, was meinst du?"}
          </p>
        )}
      </div>
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
            {/* Focus lands here (keyboard, screen reader); Escape closes it too. */}
            <button type="button" autoFocus onClick={() => setMatch(null)} className="press h-[52px] rounded-full border-2 border-ink text-base font-bold">
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
