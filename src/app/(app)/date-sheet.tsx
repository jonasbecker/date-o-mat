"use client";

// "date steht." (docs/design/garten/date-steht/DATE-STEHT.md): the date card is a sheet – tap it or pull it
// up. Its bottom edge stays put, only its top moves; three stops: "zu" (just the title and when · where),
// "mitte" (the flower is pushed up next to the headline, gently – "sanft" – or kicked away – "schubs", a fast
// flick – its thought bubble always comes out of its mouth) and "voll" (the card covers the screen, its handle
// becomes the header's step bar, the flower flies off the top and comes back down when the card goes down).
// The geometry is core/date-sheet.ts; the server renders the texts, the card's head and its details.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bloom } from "@/components/bloom";
import { useFlowerVoice, VoiceBubble } from "@/components/flower-voice";
import { bloomSaying, type FlowerPot, type Stimmung } from "@/core/bloom";
import {
  bubbleAt,
  bubbleDots,
  cardAt,
  FLY,
  poseAt,
  poseTransform,
  position,
  release,
  SHEET,
  sheetLayout,
  TIMING,
  type Pose,
  type SheetLayout,
  type Stop,
  type Tempo,
} from "@/core/date-sheet";
import { cn } from "@/lib/cn";

type Phase = { stop: Stop; tempo: Tempo };
type Drag = { startY: number; startTop: number; from: Stop; moved: boolean; samples: Array<{ y: number; t: number }>; top?: number };

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
  const scroller = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SheetLayout | null>(null);
  const [phase, setPhase] = useState<Phase>({ stop: "zu", tempo: "sanft" });
  const stopNow = useRef<Stop>("zu");
  // While a finger moves the card: its top (px); null = at rest.
  const [dragTop, setDragTop] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [kick, setKick] = useState(false);
  // Bubble and dots glide only while the card settles – new measurements (a notice appeared) put them right away.
  const [gliding, setGliding] = useState(false);
  const glideTimer = useRef<number | null>(null);
  const [words, setWords] = useState<string | null>(null);
  const [bubbleH, setBubbleH] = useState(60);
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
          bar: barBox && barBox.width > 0 ? { y: barBox.top + barBox.height / 2 - box.top, w: barBox.width, h: barBox.height } : undefined,
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
  }, [words, phase, layout]);

  const timing = reduced ? { ms: 200, ease: "ease", cardEase: "ease" } : TIMING[phase.tempo];
  const flat = (p: Pose): Pose => (reduced ? { ...p, r: 0 } : p);
  const restPose = (l: SheetLayout, { stop, tempo }: Phase): Pose => (stop === "zu" ? l.zu : stop === "mitte" ? l.mitte[tempo] : l.voll);

  /** Moves the flower to `to`: a kick goes through the "via" pose with an overshoot, off the top it speeds up, back down it lands softly. */
  const animateFlower = useCallback(
    (to: Pose, tempo: Tempo, how: "plain" | "kick" | "out" | "back") => {
      const el = flower.current;
      if (!el || !layout || typeof el.animate !== "function") return;
      const from = getComputedStyle(el).transform;
      el.getAnimations().forEach((a) => a.cancel());
      if (reduced) {
        el.animate([{ transform: from === "none" ? undefined : from }, { transform: poseTransform(flat(to)) }], { duration: 200, easing: "ease" });
        return;
      }
      const t = how === "out" ? FLY.out : how === "back" ? FLY.back : TIMING[tempo];
      const frames: Keyframe[] =
        how === "kick"
          ? [
              { transform: from, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" },
              { transform: poseTransform(layout.via.schubs), offset: 0.4, easing: TIMING.schubs.ease },
              { transform: poseTransform(to) },
            ]
          : [{ transform: from, easing: t.ease }, { transform: poseTransform(to) }];
      el.animate(frames, { duration: t.ms });
    },
    // flat() only depends on `reduced`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, reduced],
  );

  /** Lets the card come to rest at `to`; `at`: where it was (0 … 2) – coming down from above voll the flower flies back in. */
  const settle = useCallback(
    (to: Stop, tempo: Tempo, at?: number) => {
      if (!layout) return;
      const from = stopNow.current;
      const was = at ?? (from === "zu" ? 0 : from === "mitte" ? 1 : 2);
      stopNow.current = to;
      setDragTop(null);
      setPhase({ stop: to, tempo });
      setGliding(true);
      if (glideTimer.current) window.clearTimeout(glideTimer.current);
      glideTimer.current = window.setTimeout(() => setGliding(false), (reduced ? 200 : TIMING[tempo].ms) + 50);
      setMoving(to !== "zu");
      const pool: Stimmung = tempo === "schubs" ? "autsch" : "genervt";
      if (to === "mitte" || to === "zu") setWords(to === "mitte" ? bloomSaying(pool, Math.floor(Math.random() * 1000), { partner: voice.partnerName }) : null);
      const how = to === "voll" ? "out" : was > 1 ? "back" : to === "mitte" && tempo === "schubs" && was < 1 ? "kick" : "plain";
      animateFlower(restPose(layout, { stop: to, tempo }), tempo, how);
      if (how === "kick" && !reduced) {
        setKick(true);
        window.setTimeout(() => setKick(false), 400);
      }
      // The back gesture closes the card (one history entry while it is up).
      if (to !== "zu" && !pushed.current) {
        window.history.pushState({ dateSheet: true }, "");
        pushed.current = true;
      }
      if (to === "zu" && pushed.current) {
        pushed.current = false;
        if (window.history.state?.dateSheet) window.history.back();
      }
    },
    [layout, animateFlower, reduced, voice.partnerName],
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
  const cardTop = !layout ? null : (dragTop ?? layout.tops[phase.stop]);

  const start = (y: number) => {
    if (!layout) return;
    drag.current = { startY: y, startTop: cardTop ?? layout.tops.zu, from: phase.stop, moved: false, samples: [{ y, t: performance.now() }] };
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
    d.samples.push({ y, t: performance.now() });
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
    // Upwards is positive.
    const speed = (first.y - last.y) / Math.max(1, last.t - first.t);
    const at = position(d.top ?? dragTop ?? d.startTop, layout);
    const { to, tempo } = release(at, d.from, speed);
    settle(to, tempo, at);
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
    if (!el || phase.stop !== "mitte" || dragTop !== null) return;
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
  }, [phase.stop, dragTop, settle, timing.ms]);

  // --- What to draw --------------------------------------------------------------------------------
  const dragging = dragTop !== null;
  const at = layout && cardTop !== null ? position(cardTop, layout) : 0;
  const pose: Pose | null = !layout ? null : dragging ? poseAt(at, layout) : restPose(layout, phase);
  const bubble = !layout ? null : dragging ? bubbleAt(at, layout) : phase.stop === "voll" ? { box: layout.bubbleMitte[phase.tempo], opacity: 0 } : bubbleAt(phase.stop === "zu" ? 0 : 1, layout, phase.tempo);
  const look = layout ? cardAt(at, layout) : null;
  const mood: Stimmung = !moving && phase.stop === "zu" ? "froh" : dragging || phase.tempo === "sanft" ? "genervt" : "autsch";
  const dots = pose && bubble ? bubbleDots(flat(pose), { x: bubble.box.x, y: bubble.box.y, w: bubble.box.w, h: bubbleH }) : null;
  const glide = dragging || !gliding ? "none" : `${timing.ms}ms ease`;
  const cardGlide = dragging ? "none" : `${timing.ms}ms ${timing.cardEase}`;
  const showVoice = !moving && phase.stop === "zu";
  const stop = phase.stop;
  const up = stop !== "zu" && !dragging;
  // From mitte to voll the handle turns into the step bar (the bar's color: ink).
  const ink = Math.max(0, Math.min(1, at - 1));

  return (
    <div ref={root} data-date-sheet={stop} data-tempo={phase.tempo} data-moving={moving || phase.stop !== "zu" ? "" : undefined} className="relative min-h-0 flex-1">
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

      {dots && bubble && (
        <div aria-hidden={bubble.opacity === 0 ? true : undefined} style={{ opacity: bubble.opacity, transition: dragging ? "none" : "opacity 250ms ease" }} className={cn(bubble.opacity === 0 && "pointer-events-none")}>
          <span aria-hidden="true" className="absolute left-0 top-0 z-[5] size-1.5 rounded-full bg-ink" style={{ transform: `translate3d(${dots.small.x}px, ${dots.small.y}px, 0)`, transition: `transform ${glide}` }} />
          <span aria-hidden="true" className="absolute left-0 top-0 z-[5] size-2.5 rounded-full bg-ink" style={{ transform: `translate3d(${dots.big.x}px, ${dots.big.y}px, 0)`, transition: `transform ${glide}` }} />
          <div
            ref={bubbleEl}
            data-sheet-bubble
            className="absolute left-0 top-0 z-[5] origin-center"
            style={{
              width: bubble.box.w,
              transform: `translate3d(${bubble.box.x}px, ${bubble.box.y}px, 0) rotate(${reduced ? 0 : bubble.box.rotate}deg)`,
              transition: `transform ${glide}`,
            }}
          >
            <VoiceBubble
              voice={showVoice ? flowerVoice : { words: words ?? saying, hint: null, sheet: null }}
              className="block w-full rounded-[20px] bg-ink px-2.5 pb-[11px] pt-[9px] text-center font-hand font-semibold leading-[1.02] text-[#1B2620]"
              style={{ fontSize: bubble.box.fontSize }}
            />
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
