"use client";

// "date steht." (docs/design/garten/date-steht/DATE-STEHT.md): the date card is a sheet – tap it or pull it
// up. Its bottom edge stays put, only its top moves; three stops: "zu" (just the title and when · where),
// "mitte" (the flower is pushed up next to the headline, gently – "sanft" – or kicked away – "schubs", a fast
// flick – its thought bubble always comes out of its mouth) and "voll" (the card covers the screen, its handle
// becomes the header's step bar, the flower flies off the top and comes back down when the card goes down).
// Held still before letting go, the card stays right there ("parked") – the next tap takes it to the nearest stop.
// The geometry is core/date-sheet.ts; the server renders the texts, the card's head and its details.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bloom } from "@/components/bloom";
import { useFlowerVoice, VoiceBubble } from "@/components/flower-voice";
import { bloomSaying, type FlowerPot, type Stimmung } from "@/core/bloom";
import {
  bubbleDots,
  cardAt,
  FLY,
  glide as glideRun,
  morphAt,
  morphTransform,
  nearest,
  parks,
  poseAt,
  poseTransform,
  position,
  release,
  SHEET,
  sheetLayout,
  TIMING,
  topAt,
  type Pose,
  type SheetLayout,
  type Stop,
  type Tempo,
} from "@/core/date-sheet";
import { cn } from "@/lib/cn";

type Phase = { stop: Stop; tempo: Tempo };
type Drag = {
  startY: number;
  startTop: number;
  from: Stop;
  moved: boolean;
  samples: Array<{ y: number; t: number }>;
  top?: number;
  /** Where and when the finger last really moved: held still long enough, the card stays where it is. */
  lastY: number;
  lastMoved: number;
};

const BUBBLE_CLASS = "block w-full rounded-[20px] bg-ink px-2.5 pb-[11px] pt-[9px] text-center font-hand font-semibold leading-[1.02] text-[#1B2620]";

/** One of the bubble's two dots (top left at `at`). */
function Dot({ at, size, glide }: { at: { x: number; y: number }; size: "small" | "big"; glide: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute left-0 top-0 z-[5] rounded-full bg-ink", size === "small" ? "size-1.5" : "size-2.5")}
      style={{ transform: `translate3d(${at.x}px, ${at.y}px, 0)`, transition: `transform ${glide}` }}
    />
  );
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
  const zuBubbleEl = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SheetLayout | null>(null);
  const [phase, setPhase] = useState<Phase>({ stop: "zu", tempo: "sanft" });
  const stopNow = useRef<Stop>("zu");
  const parkedNow = useRef<number | null>(null);
  // While a finger moves the card: its top (px); null = at rest.
  const [dragTop, setDragTop] = useState<number | null>(null);
  // Let go after holding still: where it stays (0 … 2) until the next tap; null = at a stop.
  const [parked, setParked] = useState<number | null>(null);
  // How the last glide to a stop runs (its time follows the way, it starts at the finger's speed).
  const [motion, setMotion] = useState<{ ms: number; ease: string }>({ ms: TIMING.sanft.ms, ease: TIMING.sanft.cardEase });
  const [moving, setMoving] = useState(false);
  const [kick, setKick] = useState(false);
  // Bubble and dots glide only while the card settles – new measurements (a notice appeared) put them right away.
  const [gliding, setGliding] = useState(false);
  const glideTimer = useRef<number | null>(null);
  const [words, setWords] = useState<string | null>(null);
  const [bubbleH, setBubbleH] = useState(60);
  const [zuBubbleH, setZuBubbleH] = useState(70);
  const [more, setMore] = useState(false);
  const [reduced, setReduced] = useState(false);
  const drag = useRef<Drag | null>(null);
  const dragFrame = useRef<number | null>(null);
  const clip = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);
  const flowerVoice = useFlowerVoice({ text: saying, ...voice });

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

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The dots aim at the bubble's corner: its height depends on the words.
  useLayoutEffect(() => {
    if (bubbleEl.current) setBubbleH(bubbleEl.current.offsetHeight);
    if (zuBubbleEl.current) setZuBubbleH(zuBubbleEl.current.offsetHeight);
  }, [words, phase, layout]);

  const timing = reduced ? { ms: 200, ease: "ease", cardEase: "ease" } : { ms: motion.ms, ease: TIMING[phase.tempo].ease, cardEase: motion.ease };
  const flat = (p: Pose): Pose => (reduced ? { ...p, r: 0 } : p);
  const restPose = (l: SheetLayout, { stop, tempo }: Phase): Pose => (stop === "zu" ? l.zu : stop === "mitte" ? l.mitte[tempo] : l.voll);

  /** Moves the flower to `to`: a kick goes through the "via" pose with an overshoot, off the top it speeds up, back down it lands softly. */
  const animateFlower = useCallback(
    (to: Pose, tempo: Tempo, how: "plain" | "kick" | "out" | "back", run: { ms: number; ease: string }) => {
      const el = flower.current;
      if (!el || !layout || typeof el.animate !== "function") return;
      const from = getComputedStyle(el).transform;
      el.getAnimations().forEach((a) => a.cancel());
      if (reduced) {
        el.animate([{ transform: from === "none" ? undefined : from }, { transform: poseTransform(flat(to)) }], { duration: 200, easing: "ease" });
        return;
      }
      const end = poseTransform(to);
      let frames: Keyframe[];
      let ms: number;
      if (how === "kick") {
        ms = TIMING.schubs.ms;
        frames = [
          { transform: from, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" },
          { transform: poseTransform(layout.via.schubs), offset: 0.4, easing: TIMING.schubs.ease },
          { transform: end },
        ];
      } else if (how === "out") {
        ms = FLY.out.ms;
        frames = [{ transform: from, easing: FLY.out.ease }, { transform: end }];
      } else if (how === "back") {
        // Comes down, lands a touch too low (the stem gives) and straightens up.
        ms = FLY.back.ms;
        frames = [
          { transform: from, easing: FLY.back.ease },
          { transform: poseTransform({ ...to, y: to.y + 7 * to.s / 0.32, r: to.r + 3 }), offset: 0.78, easing: "cubic-bezier(0.3, 0, 0.3, 1)" },
          { transform: end },
        ];
      } else {
        // With the card (same time, same start speed), and a small sway as it stops.
        const sway = tempo === "schubs" ? 0 : 2.5;
        ms = Math.max(run.ms, 360);
        frames = sway
          ? [{ transform: from, easing: run.ease }, { transform: poseTransform({ ...to, r: to.r - sway }), offset: 0.86, easing: "ease-in-out" }, { transform: end }]
          : [{ transform: from, easing: run.ease }, { transform: end }];
      }
      el.animate(frames, { duration: ms });
    },
    // flat() only depends on `reduced`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, reduced],
  );

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

  /**
   * Lets the card come to rest at `to`; `at`: where it was (0 … 2) – coming down from above voll the flower flies
   * back in; `speed`: the finger's (px/ms, upwards positive) – the glide starts with it.
   */
  const settle = useCallback(
    (to: Stop, tempo: Tempo, at?: number, speed = 0) => {
      if (!layout) return;
      const from = stopNow.current;
      const was = at ?? parkedNow.current ?? (from === "zu" ? 0 : from === "mitte" ? 1 : 2);
      parkedNow.current = null;
      const way = topAt(was, layout) - layout.tops[to];
      const run = glideRun(way, way > 0 ? speed : -speed, tempo);
      stopNow.current = to;
      setDragTop(null);
      setParked(null);
      setMotion(run);
      setPhase({ stop: to, tempo });
      setGliding(true);
      if (glideTimer.current) window.clearTimeout(glideTimer.current);
      glideTimer.current = window.setTimeout(() => setGliding(false), (reduced ? 200 : run.ms) + 50);
      setMoving(to !== "zu");
      const pool: Stimmung = tempo === "schubs" ? "autsch" : "genervt";
      if (to === "mitte" || to === "zu") setWords(to === "mitte" ? bloomSaying(pool, Math.floor(Math.random() * 1000), { partner: voice.partnerName }) : null);
      const how = to === "voll" ? "out" : was > 1 ? "back" : to === "mitte" && tempo === "schubs" && was < 1 ? "kick" : "plain";
      animateFlower(restPose(layout, { stop: to, tempo }), tempo, how, run);
      if (how === "kick" && !reduced) {
        setKick(true);
        window.setTimeout(() => setKick(false), 400);
      }
      remember(to !== "zu");
    },
    [layout, animateFlower, reduced, voice.partnerName, remember],
  );

  /** Let go after holding still: everything stays where the finger left it – nothing animates. */
  const park = useCallback(
    (at: number) => {
      const stop = nearest(at);
      stopNow.current = stop;
      parkedNow.current = at;
      setDragTop(null);
      setParked(at);
      // Only the bubble moves: it grows the rest of the way, with a little spring.
      setMotion({ ms: 420, ease: "cubic-bezier(0.2, 0.9, 0.3, 1.15)" });
      setGliding(true);
      if (glideTimer.current) window.clearTimeout(glideTimer.current);
      glideTimer.current = window.setTimeout(() => setGliding(false), 470);
      setPhase({ stop, tempo: "sanft" });
      remember(true);
    },
    [remember],
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
  const cardTop = !layout ? null : (dragTop ?? (parked !== null ? topAt(parked, layout) : layout.tops[phase.stop]));

  const start = (y: number) => {
    if (!layout) return;
    const now = performance.now();
    drag.current = { startY: y, startTop: cardTop ?? layout.tops.zu, from: phase.stop, moved: false, samples: [{ y, t: now }], lastY: y, lastMoved: now };
  };
  const move = (y: number): boolean => {
    const d = drag.current;
    if (!d || !layout) return false;
    if (!d.moved && Math.abs(y - d.startY) < 6) return false;
    if (!d.moved) {
      d.moved = true;
      flower.current?.getAnimations().forEach((a) => a.cancel());
      setMoving(true);
      setWords(bloomSaying("genervt", 0, { partner: voice.partnerName }));
    }
    const top = Math.max(layout.tops.voll, Math.min(layout.tops.zu + 30, d.startTop + (y - d.startY)));
    const now = performance.now();
    d.samples.push({ y, t: now });
    if (Math.abs(y - d.lastY) >= 2) {
      d.lastY = y;
      d.lastMoved = now;
    }
    if (d.samples.length > 6) d.samples.shift();
    // At most one render per frame (a 120 Hz phone sends twice as many moves as it shows).
    d.top = top;
    if (dragFrame.current === null) {
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = null;
        if (drag.current) setDragTop(drag.current.top ?? null);
      });
    }
    return true;
  };
  const end = (): boolean => {
    const d = drag.current;
    drag.current = null;
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    if (!d || !layout) return false;
    if (!d.moved) return false;
    const first = d.samples[0];
    const last = d.samples.at(-1)!;
    const held = performance.now() - d.lastMoved;
    const at = position(d.top ?? dragTop ?? d.startTop, layout);
    // Held still: it stays right there.
    if (parks(at, held)) {
      park(at);
      return true;
    }
    // Upwards is positive; a finger that rested a moment has no speed left.
    const speed = held > 120 ? 0 : (first.y - last.y) / Math.max(1, last.t - first.t);
    const { to, tempo } = release(at, d.from, speed);
    settle(to, tempo, at, speed);
    return true;
  };

  // A tap: zu → mitte → zu, voll → mitte; parked: to the nearest stop (keyboard: Enter / Space on the same button).
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
    if (parked !== null) settle(nearest(parked), "sanft", parked);
    else settle(phase.stop === "zu" ? "mitte" : phase.stop === "mitte" ? "zu" : "mitte", "sanft");
  };

  // Inside the card: at mitte the content does not scroll – a pull moves the card (up to voll, down to zu);
  // at voll it scrolls only if it has to, and at its top pulling down brings the card down.
  useEffect(() => {
    const el = scroller.current;
    if (!el || phase.stop === "zu") return;
    let from: number | null = null;
    const onStart = (e: TouchEvent) => {
      from = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (from === null) return;
      const y = e.touches[0].clientY;
      if (!drag.current) {
        if (Math.abs(y - from) < 8) return;
        if (phase.stop === "voll" && (y < from || el.scrollTop > 0)) {
          from = null; // the content's turn
          return;
        }
        start(from);
      }
      e.preventDefault();
      move(y);
    };
    const onEnd = () => {
      from = null;
      end();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  });

  // At mitte the rest is cut off (a soft fade says there is more). Should the browser scroll it anyway – the
  // keyboard focus moved into it, or a link further down was looked for – the card goes up to voll.
  useEffect(() => {
    const el = scroller.current;
    if (!el || phase.stop !== "mitte" || dragTop !== null || parked !== null) return;
    // The content box is as high as at voll; what shows at mitte is the card's frame (clip).
    const visibleHeight = () => clip.current?.clientHeight ?? el.clientHeight;
    const timer = window.setTimeout(() => setMore(el.scrollHeight > visibleHeight() + 4), timing.ms);
    const onScroll = () => {
      if (el.scrollTop > 0 && stopNow.current === "mitte") settle("voll", "sanft");
    };
    const onFocus = (e: FocusEvent) => {
      const frame = clip.current?.getBoundingClientRect();
      const target = (e.target as Element).getBoundingClientRect();
      if (frame && target.bottom > frame.bottom && stopNow.current === "mitte") settle("voll", "sanft");
    };
    el.addEventListener("scroll", onScroll);
    el.addEventListener("focusin", onFocus);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("focusin", onFocus);
    };
  }, [phase.stop, dragTop, parked, settle, timing.ms]);

  // --- What to draw --------------------------------------------------------------------------------
  const dragging = dragTop !== null;
  // Following the card: while a finger moves it, and where it was left.
  const free = dragging || parked !== null;
  const at = layout && cardTop !== null ? position(cardTop, layout) : 0;
  const pose: Pose | null = !layout ? null : free ? poseAt(at, layout) : restPose(layout, phase);
  // Two bubbles: the flower's own by its head while the card is down; the one at mitte grows out of the header's
  // step bar as the card comes up (and shrinks back into it on the way to voll).
  const zuBox = layout?.bubbleZu ?? null;
  const mitteBox = layout ? layout.bubbleMitte[free ? "sanft" : phase.tempo] : null;
  // Parked, the bubble does not stay half grown: it finishes growing (words and all) – or, near zu, the flower's own one is back.
  const parkedBubble = parked !== null ? (parked < 0.25 ? "zu" : parked > 1.75 ? "none" : "mitte") : null;
  const morph = parkedBubble ? (parkedBubble === "mitte" ? { grow: 1, opacity: 1 } : { grow: 0, opacity: 0 }) : free ? morphAt(at) : phase.stop === "mitte" ? { grow: 1, opacity: 1 } : { grow: 0, opacity: 0 };
  const zuOpacity = parkedBubble ? (parkedBubble === "zu" ? 1 : 0) : free ? Math.max(0, 1 - at * 4) : phase.stop === "zu" && !moving ? 1 : 0;
  const wordsOpacity = Math.max(0, Math.min(1, (morph.grow - 0.75) / 0.25));
  const mitteDotsOpacity = Math.max(0, Math.min(1, (morph.grow - 0.8) / 0.2)) * morph.opacity;
  const look = layout ? cardAt(at, layout) : null;
  const mood: Stimmung = !moving && phase.stop === "zu" ? "froh" : free || phase.tempo === "sanft" ? "genervt" : "autsch";
  const zuDots = pose && zuBox ? bubbleDots(flat(pose), { x: zuBox.x, y: zuBox.y, w: zuBox.w, h: zuBubbleH }) : null;
  const mitteDots = pose && mitteBox ? bubbleDots(flat(pose), { x: mitteBox.x, y: mitteBox.y, w: mitteBox.w, h: bubbleH }) : null;
  const fade = dragging ? "none" : "opacity 250ms ease";
  const glide = dragging || !gliding ? "none" : `${timing.ms}ms ease`;
  const cardGlide = dragging ? "none" : `${timing.ms}ms ${timing.cardEase}`;
  const stop = phase.stop;
  const up = stop !== "zu" && !dragging;
  // From mitte to voll the handle turns into the step bar (the bar's color: ink).
  const ink = Math.max(0, Math.min(1, at - 1));

  return (
    <div ref={root} data-date-sheet={stop} data-parked={parked !== null ? "" : undefined} data-tempo={phase.tempo} data-moving={moving || phase.stop !== "zu" ? "" : undefined} className="relative min-h-0 flex-1">
      <div ref={flow}>
        {headline}
        <div data-sheet-above className="transition-opacity duration-300" style={{ opacity: moving || phase.stop !== "zu" ? 0 : 1 }} aria-hidden={moving || phase.stop !== "zu" ? true : undefined}>
          {above}
        </div>
      </div>

      {layout && pose && (
        <div
          ref={flower}
          aria-hidden="true"
          data-sheet-flower
          className="pointer-events-none absolute left-0 top-0 z-[3] h-[420px] w-[300px] origin-top-left"
          style={{ transform: poseTransform(flat(pose)) }}
        >
          <Bloom stimmung={mood} blaetter={bloom.blaetter} welk={bloom.welk} topf={bloom.pot} className="size-full" />
        </div>
      )}

      {layout &&
        kick &&
        layout.lines.map((l, i) => (
          <span key={i} aria-hidden="true" className="animate-fade-out pointer-events-none absolute z-[4] h-[3px] -rotate-[40deg] rounded-sm bg-butter opacity-70" style={{ left: l.x, top: l.y, width: l.w }} />
        ))}

      {zuDots && zuBox && (
        <div aria-hidden={zuOpacity === 0 ? true : undefined} style={{ opacity: zuOpacity, transition: fade }} className={cn(zuOpacity === 0 && "pointer-events-none")}>
          <Dot at={zuDots.small} size="small" glide={glide} />
          <Dot at={zuDots.big} size="big" glide={glide} />
          <div
            ref={zuBubbleEl}
            data-sheet-bubble="zu"
            className="absolute left-0 top-0 z-[5] origin-center"
            style={{ width: zuBox.w, transform: `translate3d(${zuBox.x}px, ${zuBox.y}px, 0) rotate(${reduced ? 0 : zuBox.rotate}deg)`, transition: `transform ${glide}` }}
          >
            <VoiceBubble voice={flowerVoice} className={BUBBLE_CLASS} style={{ fontSize: zuBox.fontSize }} />
          </div>
        </div>
      )}
      {mitteDots && mitteBox && layout && (
        <div aria-hidden={morph.opacity === 0 ? true : undefined} className="pointer-events-none">
          <div style={{ opacity: mitteDotsOpacity, transition: fade }}>
            <Dot at={mitteDots.small} size="small" glide={glide} />
            <Dot at={mitteDots.big} size="big" glide={glide} />
          </div>
          {/* Grows out of the step bar: same ink, scaled from the bar's size to its own. */}
          <div
            ref={bubbleEl}
            data-sheet-bubble="mitte"
            className="absolute left-0 top-0 z-[5] origin-center rounded-[20px] bg-ink will-change-transform"
            style={{
              width: mitteBox.w,
              opacity: morph.opacity,
              transform: morphTransform({ ...mitteBox, rotate: reduced ? 0 : mitteBox.rotate }, bubbleH, layout.bar, morph.grow),
              transition: dragging ? "none" : `transform ${timing.ms}ms ${timing.cardEase}, opacity 250ms ease`,
            }}
          >
            <p
              className="px-2.5 pb-[11px] pt-[9px] text-center font-hand font-semibold leading-[1.02] text-[#1B2620]"
              style={{ fontSize: mitteBox.fontSize, opacity: wordsOpacity, transition: dragging ? "none" : `opacity 200ms ease ${morph.grow === 1 ? timing.ms * 0.6 : 0}ms` }}
            >
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
        style={
          layout && cardTop !== null && look
            ? {
                top: cardTop,
                bottom: -look.bottom,
                left: -look.inset,
                right: -look.inset,
                borderRadius: `${look.radius}px ${look.radius}px ${look.radius}px ${look.radius}px`,
                transition: `top ${cardGlide}, bottom ${cardGlide}, left ${cardGlide}, right ${cardGlide}, border-radius ${cardGlide}`,
              }
            : undefined
        }
      >
        <div
          className={cn("flex flex-col", layout ? "absolute top-0" : "contents")}
          style={layout && look ? { left: -(SHEET.insetVoll - look.inset), width: layout.width + 2 * SHEET.insetVoll, height: layout.height + SHEET.overhangVoll - layout.tops.voll, transition: dragging ? "none" : `left ${cardGlide}` } : undefined}
        >
        <button
          type="button"
          aria-expanded={stop !== "zu"}
          aria-label={LABEL[stop]}
          onPointerDown={onHeadPointerDown}
          onPointerMove={(e) => move(e.clientY)}
          onPointerUp={onHeadPointerUp}
          onPointerCancel={onHeadPointerUp}
          onClick={onHeadClick}
          className="absolute inset-x-0 top-0 z-[2] touch-none bg-transparent"
          style={{ height: stop === "zu" || !look ? "100%" : look.padTop + (layout?.headH ?? 80) }}
        />
        <span
          aria-hidden="true"
          data-sheet-handle
          className="absolute left-1/2 -translate-x-1/2 rounded-[3px]"
          style={
            look
              ? {
                  top: look.handle.top,
                  width: look.handle.w,
                  height: look.handle.h,
                  backgroundColor: `color-mix(in srgb, var(--color-ink) ${Math.round(ink * 100)}%, #3A4A40)`,
                  transition: dragging ? "none" : `top ${cardGlide}, width ${cardGlide}, height ${cardGlide}, background-color ${cardGlide}`,
                }
              : { top: 8, width: 38, height: 4, backgroundColor: "#3A4A40" }
          }
        />
        <div
          ref={scroller}
          className={cn("flex min-h-0 flex-1 flex-col gap-2.5 overscroll-contain px-[22px] pb-[18px]", up && phase.stop === "voll" ? "overflow-y-auto" : "overflow-hidden")}
          style={{ paddingTop: look?.padTop ?? 24, paddingInline: layout ? 22 + SHEET.insetVoll - SHEET.insetZu : 22, transition: dragging ? "none" : `padding-top ${cardGlide}` }}
        >
          <div ref={headEl} className="flex flex-col gap-2.5">
            {head}
          </div>
          <div
            data-sheet-details
            inert={!up}
            className={cn("flex flex-col gap-2.5", !layout && "hidden")}
            style={{
              opacity: up ? 1 : 0,
              transform: up ? "none" : "translateY(16px)",
              transition: `opacity 400ms ease ${up ? 250 : 0}ms, transform 400ms ease ${up ? 250 : 0}ms`,
            }}
          >
            {details}
          </div>
        </div>
        </div>
        {/* At mitte the rest is cut off: a soft fade, pull up for all of it. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent transition-opacity duration-300" style={{ opacity: more && up && stop === "mitte" ? 1 : 0 }} />
      </div>
    </div>
  );
}
