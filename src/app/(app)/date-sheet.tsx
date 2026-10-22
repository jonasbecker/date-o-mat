"use client";

// "date steht." (docs/design/garten/date-steht/DATE-STEHT.md): the date card is a sheet – tap it or pull it
// up. Its bottom edge stays put, only its top moves; three stops: "zu" (just the title and when · where),
// "mitte" (the flower is pushed up next to the headline, gently – "sanft" – or kicked away – "schubs", a fast
// flick – its thought bubble always comes out of its mouth) and "voll" (the card covers the screen, its handle
// becomes the header's step bar, the flower flies off the top and comes back down when the card goes down).
// One number moves it all: the card's top. The finger sets it directly, letting go a spring takes it to the
// nearest stop (starting at the finger's speed), and every frame the flower, its bubble, the handle and the
// details are drawn from it – straight into the DOM, React only hears the stop. Grabbed while it moves, it stops
// under the finger. The geometry is core/date-sheet.ts; the server renders the texts, the card's head and its details.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bloom } from "@/components/bloom";
import { useFlowerVoice, VoiceBubble } from "@/components/flower-voice";
import { bloomSaying, type FlowerPot, type Stimmung } from "@/core/bloom";
import {
  atRest,
  bubbleDots,
  cardAt,
  follow,
  leaned,
  leanFor,
  morphAt,
  morphTransform,
  poseAt,
  poseTransform,
  position,
  release,
  SHEET,
  sheetLayout,
  springStep,
  type SheetLayout,
  type Stop,
  type Tempo,
} from "@/core/date-sheet";
import { cn } from "@/lib/cn";

type Phase = { stop: Stop; tempo: Tempo };
type Drag = {
  startY: number;
  startTop: number;
  moved: boolean;
  /** It was on its way when the finger caught it: let go without moving, it goes to the nearest stop (not a tap). */
  caught: boolean;
  /** Where the finger wants the card. */
  top: number;
  samples: Array<{ y: number; t: number }>;
};

const BUBBLE_CLASS = "block w-full rounded-[20px] bg-ink px-2.5 pb-[11px] pt-[9px] text-center font-hand font-semibold leading-[1.02] text-[#1B2620]";
const DOT = "absolute left-0 top-0 z-[5] rounded-full bg-ink";
/** Reduced motion: a short plain glide instead of the spring. */
const CALM_MS = 200;

/** The finger's speed over its last moments (px/ms, downwards positive) – 0 once it rested. */
function fingerSpeed(samples: Drag["samples"], now: number): number {
  const last = samples.at(-1);
  if (!last || now - last.t > 80) return 0;
  const first = samples.find((p) => p.t >= last.t - 100) ?? last;
  return last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
}

const LABEL: Record<Stop, string> = { zu: "Details öffnen", mitte: "Details schließen", voll: "Weniger Details" };

export function DateSheet({
  headline,
  above,
  head,
  details,
  saying,
  voice,
  bloom,
}: {
  /** "date\nsteht." */
  headline: ReactNode;
  /** Week bar, subtitle, notices – they fade once the card moves. */
  above: ReactNode;
  /** Title and when · where: all the closed card shows. */
  head: ReactNode;
  /** Calendar chip, map, rows, Route / Verschieben / Absagen: covered while closed. */
  details: ReactNode;
  /** What the happy flower says while the card is closed. */
  saying: string;
  voice: { publicKey: string | null; myDevices: number; partnerDevices: number; partnerName: string };
  bloom: { blaetter: number; welk: number; pot: FlowerPot };
}) {
  const root = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const headEl = useRef<HTMLDivElement>(null);
  const flower = useRef<HTMLDivElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);
  const wordsEl = useRef<HTMLParagraphElement>(null);
  const mitteWrap = useRef<HTMLDivElement>(null);
  const mitteDotsEl = useRef<HTMLDivElement>(null);
  const zuWrap = useRef<HTMLDivElement>(null);
  const zuBubbleEl = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const headButton = useRef<HTMLButtonElement>(null);
  const handleEl = useRef<HTMLSpanElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const detailsEl = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SheetLayout | null>(null);
  const [phase, setPhase] = useState<Phase>({ stop: "zu", tempo: "sanft" });
  // Not resting at zu (a finger has it, or it is up): the text above fades, the step bar steps aside.
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [kick, setKick] = useState(false);
  const [words, setWords] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [reduced, setReduced] = useState(false);
  const flowerVoice = useFlowerVoice({ text: saying, ...voice });

  // What every frame reads (the animation runs outside React).
  const live = useRef({ layout: null as SheetLayout | null, stop: "zu" as Stop, tempo: "sanft" as Tempo, reduced: false, bubbleH: 60, zuBubbleH: 70 });
  /** The card's top (px) and speed (px/ms, downwards positive); `lean`: the speed the flower feels (a little behind). */
  const motion = useRef({ top: null as number | null, v: 0, lean: 0, last: 0, calm: { from: 0, t0: 0 } });
  const frame = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const pushed = useRef(false);

  /** Draws everything that follows the card for its current top. */
  const paint = useCallback(() => {
    const { layout: l, stop, reduced: still, bubbleH, zuBubbleH } = live.current;
    const top = motion.current.top;
    if (!l || top === null) return;
    const at = position(top, l);
    const look = cardAt(at, l);
    const base = poseAt(at, l);
    // Below zu (pulled down, or a schubs swinging past) the pot stays on the card.
    const sunk = { ...base, y: base.y + Math.max(0, top - l.tops.zu) };
    const pose = still ? { ...sunk, r: 0 } : leaned(sunk, leanFor(motion.current.lean));

    const card = clip.current;
    if (card) {
      card.style.top = `${top}px`;
      card.style.bottom = `${-look.bottom}px`;
      card.style.left = card.style.right = `${-look.inset}px`;
      card.style.borderRadius = `${look.radius}px`;
    }
    if (inner.current) inner.current.style.left = `${-(SHEET.insetVoll - look.inset)}px`;
    if (headButton.current) headButton.current.style.height = stop === "zu" ? "100%" : `${look.padTop + l.headH}px`;
    const handle = handleEl.current;
    if (handle) {
      handle.style.top = `${look.handle.top}px`;
      handle.style.width = `${look.handle.w}px`;
      handle.style.height = `${look.handle.h}px`;
      // From mitte to voll the handle turns into the step bar (the bar's color: ink).
      handle.style.backgroundColor = `color-mix(in srgb, var(--color-ink) ${Math.round(Math.max(0, Math.min(1, at - 1)) * 100)}%, #3A4A40)`;
    }
    if (scroller.current) scroller.current.style.paddingTop = `${look.padTop}px`;
    // The details come up with the card.
    const shown = Math.max(0, Math.min(1, (at - 0.3) / 0.5));
    if (detailsEl.current) {
      detailsEl.current.style.opacity = String(shown);
      detailsEl.current.style.transform = shown === 1 ? "none" : `translate3d(0, ${((1 - shown) * 16).toFixed(1)}px, 0)`;
    }
    if (flower.current) flower.current.style.transform = poseTransform(pose);

    // The flower's own bubble by its head while the card is down.
    const zu = l.bubbleZu;
    const zuOpacity = Math.max(0, 1 - at * 4);
    const zuEl = zuWrap.current;
    if (zuEl) {
      zuEl.style.opacity = String(zuOpacity);
      zuEl.style.pointerEvents = zuOpacity === 0 ? "none" : "";
      zuEl.toggleAttribute("aria-hidden", zuOpacity === 0);
      const dots = bubbleDots(pose, { x: zu.x, y: zu.y, w: zu.w, h: zuBubbleH });
      const [small, big] = zuEl.querySelectorAll<HTMLElement>("[data-dot]");
      small.style.transform = `translate3d(${dots.small.x.toFixed(1)}px, ${dots.small.y.toFixed(1)}px, 0)`;
      big.style.transform = `translate3d(${dots.big.x.toFixed(1)}px, ${dots.big.y.toFixed(1)}px, 0)`;
    }
    // The one at mitte grows out of the header's step bar as the card comes up (and shrinks back into it on the way to voll).
    const box = l.bubbleMitte;
    const morph = morphAt(at);
    if (mitteWrap.current) mitteWrap.current.toggleAttribute("aria-hidden", morph.opacity === 0);
    if (bubbleEl.current) {
      bubbleEl.current.style.opacity = String(morph.opacity);
      bubbleEl.current.style.transform = morphTransform({ ...box, rotate: still ? 0 : box.rotate }, bubbleH, l.bar, morph.grow);
    }
    if (wordsEl.current) wordsEl.current.style.opacity = String(Math.max(0, Math.min(1, (morph.grow - 0.75) / 0.25)));
    const dotsEl = mitteDotsEl.current;
    if (dotsEl) {
      dotsEl.style.opacity = String(Math.max(0, Math.min(1, (morph.grow - 0.8) / 0.2)) * morph.opacity);
      const dots = bubbleDots(pose, { x: box.x, y: box.y, w: box.w, h: bubbleH });
      const [small, big] = dotsEl.querySelectorAll<HTMLElement>("[data-dot]");
      small.style.transform = `translate3d(${dots.small.x.toFixed(1)}px, ${dots.small.y.toFixed(1)}px, 0)`;
      big.style.transform = `translate3d(${dots.big.x.toFixed(1)}px, ${dots.big.y.toFixed(1)}px, 0)`;
    }
  }, []);

  /** Came to rest at its stop. */
  const rested = useCallback(() => {
    if (live.current.stop === "zu") setMoving(false);
  }, []);

  /** Runs the frames (once – a second call while it runs does nothing): the finger's top while it holds the card, else the spring towards the stop. */
  const run = useCallback(() => {
    if (frame.current !== null) return;
    motion.current.last = performance.now();
    const step = (now: number) => {
      frame.current = null;
      const l = live.current.layout;
      const m = motion.current;
      if (!l || m.top === null) return;
      const dt = Math.min(48, Math.max(1, now - m.last));
      m.last = now;
      const d = drag.current;
      const target = l.tops[live.current.stop];
      if (d) {
        if (d.moved) m.top = d.top;
        m.v = d.moved ? fingerSpeed(d.samples, now) : 0;
      } else if (live.current.reduced) {
        const p = Math.min(1, (now - m.calm.t0) / CALM_MS);
        m.top = m.calm.from + (target - m.calm.from) * (1 - (1 - p) ** 3);
        m.v = 0;
      } else {
        const next = springStep(m.top, m.v, target, dt, live.current.tempo);
        m.top = next.top;
        m.v = next.v;
      }
      // Never above the screen's top (a schubs to voll just stops there).
      if (m.top < l.tops.voll) {
        m.top = l.tops.voll;
        m.v = Math.max(0, m.v);
      }
      m.lean += (m.v - m.lean) * Math.min(1, dt / 70);
      // Held still, nothing left to draw: wait for the next move (which starts it again).
      const done = Math.abs(m.lean) < 0.003 && (d ? m.v === 0 : atRest(m.top, m.v, target));
      if (done) {
        m.lean = 0;
        if (!d) {
          m.top = target;
          m.v = 0;
        }
      }
      paint();
      if (done) {
        if (!d) rested();
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [paint, rested]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  // Measure the area (also when it comes back from a hidden tab or the phone turns).
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const textEnd = flow.current ? flow.current.getBoundingClientRect().bottom - box.top : 200;
      const main = el.closest("main");
      // The page's header (name, avatars): the bubble at mitte sits in it, the handle ends on its step bar.
      const header = main?.querySelector("header")?.getBoundingClientRect();
      const center = main?.querySelector("[data-header-center]");
      const barBox = (center?.firstElementChild ?? center)?.getBoundingClientRect();
      setLayout(
        sheetLayout({
          width: box.width,
          height: box.height,
          flowBottom: textEnd,
          headH: headEl.current?.offsetHeight,
          headerTop: header ? header.top - box.top : undefined,
          headerBottom: header ? header.bottom - box.top : undefined,
          screenTop: main ? main.getBoundingClientRect().top - box.top : undefined,
          bar: barBox && barBox.width > 0 ? { x: barBox.left + barBox.width / 2 - box.left, y: barBox.top + barBox.height / 2 - box.top, w: barBox.width, h: barBox.height } : undefined,
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // The text above (fonts, a notice) and the card's head can grow without the area changing.
    if (flow.current) observer.observe(flow.current);
    if (headEl.current) observer.observe(headEl.current);
    return () => observer.disconnect();
  }, []);

  // A new layout: at rest the card sits on its stop's new place; moving, the next frame uses it.
  useLayoutEffect(() => {
    live.current.layout = layout;
    if (!layout) return;
    const m = motion.current;
    if (m.top === null || (frame.current === null && !drag.current)) m.top = layout.tops[live.current.stop];
    paint();
  }, [layout, paint]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(query.matches);
      live.current.reduced = query.matches;
      paint();
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [paint]);

  // The dots aim at the bubble's corner: its height depends on the words.
  useLayoutEffect(() => {
    if (bubbleEl.current) live.current.bubbleH = bubbleEl.current.offsetHeight;
    if (zuBubbleEl.current) live.current.zuBubbleH = zuBubbleEl.current.offsetHeight;
    paint();
  }, [words, layout, flowerVoice.words, paint]);

  /** The back gesture closes the card: one history entry while it is up. */
  const remember = useCallback((up: boolean) => {
    if (up && !pushed.current) {
      window.history.pushState({ dateSheet: true }, "");
      pushed.current = true;
    }
    if (!up && pushed.current) {
      pushed.current = false;
      if (window.history.state?.dateSheet) window.history.back();
    }
  }, []);

  /** Sends the card to `to` (the spring starts at the speed it has now). */
  const settle = useCallback(
    (to: Stop, tempo: Tempo) => {
      const l = live.current.layout;
      const m = motion.current;
      if (!l || m.top === null) return;
      const was = position(m.top, l);
      live.current.stop = to;
      live.current.tempo = tempo;
      m.calm = { from: m.top, t0: performance.now() };
      setPhase({ stop: to, tempo });
      if (to !== "zu") setMoving(true);
      const pool: Stimmung = tempo === "schubs" ? "autsch" : "genervt";
      setWords((now) => (to === "mitte" ? bloomSaying(pool, Math.floor(Math.random() * 1000), { partner: voice.partnerName }) : to === "zu" ? null : now));
      if (to === "mitte" && tempo === "schubs" && was < 1 && !live.current.reduced) {
        setKick(true);
        window.setTimeout(() => setKick(false), 400);
      }
      remember(to !== "zu");
      run();
    },
    [voice.partnerName, remember, run],
  );

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      settle("zu", "sanft");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [settle]);

  // --- The gesture -------------------------------------------------------------------------------
  const start = (y: number) => {
    const m = motion.current;
    if (!live.current.layout || m.top === null) return;
    // Grabbed while it moves: it stops right under the finger.
    const caught = Math.abs(m.top - live.current.layout.tops[live.current.stop]) > 1;
    m.v = 0;
    drag.current = { startY: y, startTop: m.top, moved: false, caught, top: m.top, samples: [{ y, t: performance.now() }] };
    run();
  };
  const move = (y: number): boolean => {
    const d = drag.current;
    const l = live.current.layout;
    if (!d || !l) return false;
    if (!d.moved && Math.abs(y - d.startY) < 6) return false;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      setMoving(true);
      setWords(bloomSaying("genervt", 0, { partner: voice.partnerName }));
    }
    // Right under the finger, from the very first pixel.
    d.top = follow(d.startTop + (y - d.startY), l);
    d.samples.push({ y, t: performance.now() });
    if (d.samples.length > 12) d.samples.shift();
    run();
    return true;
  };
  const end = (): boolean => {
    const d = drag.current;
    drag.current = null;
    const l = live.current.layout;
    const m = motion.current;
    if (!d || !l || m.top === null) return false;
    if (!d.moved) {
      if (!d.caught) return false;
      // Caught on its way and let go: the nearest stop.
      settle(release(m.top, 0, l).to, "sanft");
      return true;
    }
    setDragging(false);
    // Upwards is positive; a finger that rested a moment has no speed left – then it is just the nearest stop.
    const speed = -fingerSpeed(d.samples, performance.now());
    m.v = -speed;
    const { to, tempo } = release(m.top, speed, l);
    settle(to, tempo);
    return true;
  };

  // A tap: zu → mitte → zu, voll → mitte (keyboard: Enter / Space on the same button).
  const tapped = useRef(false);
  const onHeadPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start(e.clientY);
  };
  const onHeadPointerUp = () => {
    tapped.current = end();
  };
  const onHeadClick = () => {
    if (tapped.current) {
      tapped.current = false;
      return;
    }
    settle(phase.stop === "zu" ? "mitte" : phase.stop === "mitte" ? "zu" : "mitte", "sanft");
  };

  // Anywhere on the Beet, not only on the card's head: pull up – on the flower, the headline, the empty room – and
  // the card comes with the finger; once it is up, pulling down anywhere brings it down. At zu a pull down stays the
  // page's own (refresh, gestures.tsx). Inside the card at mitte the content does not scroll – a pull moves the card;
  // at voll it scrolls only if it has to, and at its top pulling down brings the card down. The listeners stay put
  // for the whole gesture (a re-render mid-way must not lose it): they call the newest handlers through a ref.
  const gesture = useRef({ start, move, end });
  useLayoutEffect(() => {
    gesture.current = { start, move, end };
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let from: { x: number; y: number; target: Element } | null = null;
    // A mouse drag that moved the card must not end in a click on what it started on.
    let swallow = false;
    /** Whether a pull from `target` in direction `dy` (down positive) moves the card. */
    const takes = (target: Element, dy: number): boolean => {
      const { stop } = live.current;
      const content = scroller.current;
      if (content && content.contains(target)) return stop === "mitte" || (stop === "voll" && dy > 0 && content.scrollTop === 0);
      if (target.closest("[data-sheet-card]")) return false;
      if (stop !== "zu") return true;
      // Closed: only up – and not while the page itself can still scroll that way (a small phone).
      const main = el.closest("main");
      return dy < 0 && (!main || main.scrollTop + main.clientHeight >= main.scrollHeight - 1);
    };
    const begin = (x: number, y: number, target: Element) => {
      // The card's head has its own handlers (and its tap).
      from = target.closest("[data-sheet-card] button[aria-expanded]") ? null : { x, y, target };
    };
    /** Returns true while the card is the finger's. */
    const follow = (x: number, y: number): boolean => {
      if (!from) return false;
      if (!drag.current) {
        const dx = x - from.x;
        const dy = y - from.y;
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return false;
        if (Math.abs(dy) <= Math.abs(dx) || !takes(from.target, dy)) {
          from = null;
          return false;
        }
        gesture.current.start(from.y);
      }
      gesture.current.move(y);
      return true;
    };
    const finish = () => {
      const had = Boolean(from && drag.current);
      from = null;
      if (had) gesture.current.end();
      return had;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      begin(e.touches[0].clientX, e.touches[0].clientY, e.target as Element);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (follow(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
    };
    const onTouchEnd = () => {
      finish();
    };
    // A mouse (desktop, tests): the same, with the pointer captured once the card is taken.
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      begin(e.clientX, e.clientY, e.target as Element);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !from) return;
      const had = Boolean(drag.current);
      if (follow(e.clientX, e.clientY) && !had) el.setPointerCapture(e.pointerId);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (finish()) {
        swallow = true;
        window.setTimeout(() => (swallow = false), 0);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClick, true);
    };
  }, []);

  // At mitte the rest is cut off (a soft fade says there is more). Should the browser scroll it anyway – the
  // keyboard focus moved into it, or a link further down was looked for – the card goes up to voll.
  useEffect(() => {
    const el = scroller.current;
    if (!el || phase.stop !== "mitte" || dragging) return;
    // The content box is as high as at voll; what shows at mitte is the card's frame (clip).
    const visibleHeight = () => clip.current?.clientHeight ?? el.clientHeight;
    const timer = window.setTimeout(() => setMore(el.scrollHeight > visibleHeight() + 4), 700);
    const onScroll = () => {
      if (el.scrollTop > 0 && live.current.stop === "mitte") settle("voll", "sanft");
    };
    const onFocus = (e: FocusEvent) => {
      const frame = clip.current?.getBoundingClientRect();
      const target = (e.target as Element).getBoundingClientRect();
      if (frame && target.bottom > frame.bottom && live.current.stop === "mitte") settle("voll", "sanft");
    };
    el.addEventListener("scroll", onScroll);
    el.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("focusin", onFocus);
    };
  }, [phase.stop, dragging, settle]);

  // --- What to draw (what follows the card is set by paint()) -----------------------------------
  const stop = phase.stop;
  const up = stop !== "zu";
  const mood: Stimmung = !moving && stop === "zu" ? "froh" : dragging || phase.tempo === "sanft" ? "genervt" : "autsch";

  return (
    <div ref={root} data-date-sheet={stop} data-tempo={phase.tempo} data-moving={moving || up ? "" : undefined} data-no-pull={moving || up ? "" : undefined} className="relative min-h-0 flex-1">
      <div ref={flow}>
        {headline}
        <div data-sheet-above className="transition-opacity duration-300" style={{ opacity: moving || up ? 0 : 1 }} aria-hidden={moving || up ? true : undefined}>
          {above}
        </div>
      </div>

      {layout && (
        <div ref={flower} aria-hidden="true" data-sheet-flower className="pointer-events-none absolute left-0 top-0 z-[3] h-[420px] w-[300px] origin-top-left will-change-transform">
          <Bloom stimmung={mood} blaetter={bloom.blaetter} welk={bloom.welk} topf={bloom.pot} className="size-full" />
        </div>
      )}

      {layout &&
        kick &&
        layout.lines.map((l, i) => (
          <span key={i} aria-hidden="true" className="animate-fade-out pointer-events-none absolute z-[4] h-[3px] -rotate-[40deg] rounded-sm bg-butter opacity-70" style={{ left: l.x, top: l.y, width: l.w }} />
        ))}

      {layout && (
        <div ref={zuWrap}>
          <span aria-hidden="true" data-dot className={cn(DOT, "size-1.5")} />
          <span aria-hidden="true" data-dot className={cn(DOT, "size-2.5")} />
          <div
            ref={zuBubbleEl}
            data-sheet-bubble="zu"
            className="absolute left-0 top-0 z-[5] origin-center"
            style={{ width: layout.bubbleZu.w, transform: `translate3d(${layout.bubbleZu.x}px, ${layout.bubbleZu.y}px, 0) rotate(${reduced ? 0 : layout.bubbleZu.rotate}deg)` }}
          >
            <VoiceBubble voice={flowerVoice} className={BUBBLE_CLASS} style={{ fontSize: layout.bubbleZu.fontSize }} />
          </div>
        </div>
      )}
      {layout && (
        <div ref={mitteWrap} className="pointer-events-none">
          <div ref={mitteDotsEl}>
            <span aria-hidden="true" data-dot className={cn(DOT, "size-1.5")} />
            <span aria-hidden="true" data-dot className={cn(DOT, "size-2.5")} />
          </div>
          {/* Grows out of the step bar: same ink, scaled from the bar's size to its own. */}
          <div ref={bubbleEl} data-sheet-bubble="mitte" className="absolute left-0 top-0 z-[5] origin-center rounded-[20px] bg-ink will-change-transform" style={{ width: layout.bubbleMitte.w }}>
            <p ref={wordsEl} className="px-2.5 pb-[11px] pt-[9px] text-center font-hand font-semibold leading-[1.02] text-[#1B2620]" style={{ fontSize: layout.bubbleMitte.fontSize }}>
              {words ?? saying}
            </p>
          </div>
        </div>
      )}
      {flowerVoice.sheet}

      {/* The card's frame moves with the finger (its edges, corners and shadow); the content inside keeps one
          fixed size – as wide as the screen, as high as at voll – so the text never wraps anew while it moves. */}
      <div
        ref={clip}
        data-sheet-card
        className={cn("absolute z-[2] bg-surface shadow-[0_-10px_30px_rgba(0,0,0,0.35)] overflow-clip", !layout && "-inset-x-2 bottom-[-20px] flex flex-col rounded-[26px]")}
      >
        <div
          ref={inner}
          className={cn("flex flex-col", layout ? "absolute top-0" : "contents")}
          style={layout ? { width: layout.width + 2 * SHEET.insetVoll, height: layout.height + SHEET.overhangVoll - layout.tops.voll } : undefined}
        >
        <button
          ref={headButton}
          type="button"
          aria-expanded={up}
          aria-label={LABEL[stop]}
          onPointerDown={onHeadPointerDown}
          onPointerMove={(e) => move(e.clientY)}
          onPointerUp={onHeadPointerUp}
          onPointerCancel={onHeadPointerUp}
          onClick={onHeadClick}
          className="absolute inset-x-0 top-0 z-[2] h-full touch-none bg-transparent"
        />
        <span ref={handleEl} aria-hidden="true" data-sheet-handle className={cn("absolute left-1/2 -translate-x-1/2 rounded-[3px]", !layout && "top-2 h-1 w-[38px] bg-[#3A4A40]")} />
        <div
          ref={scroller}
          className={cn("flex min-h-0 flex-1 flex-col gap-2.5 overscroll-contain px-[22px] pb-[18px]", !layout && "pt-6", stop === "voll" && !dragging ? "overflow-y-auto" : "overflow-hidden")}
          style={layout ? { paddingInline: 22 + SHEET.insetVoll - SHEET.insetZu } : undefined}
        >
          <div ref={headEl} className="flex flex-col gap-2.5">
            {head}
          </div>
          <div ref={detailsEl} data-sheet-details inert={!up || dragging} className={cn("flex flex-col gap-2.5", !layout && "hidden")}>
            {details}
          </div>
        </div>
        </div>
        {/* At mitte the rest is cut off: a soft fade, pull up for all of it. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent transition-opacity duration-300" style={{ opacity: more && up && !dragging && stop === "mitte" ? 1 : 0 }} />
      </div>
    </div>
  );
}
