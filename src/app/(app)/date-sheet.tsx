"use client";

// "date steht." (docs/design/garten/date-steht/DATE-STEHT.md): the date card is a sheet – tap it or pull it
// up. Its bottom edge stays put, only its top moves; the flower above it gets pushed up gently ("sanft")
// or kicked away ("schubs", a fast flick), and its thought bubble always comes out of its mouth.
// The geometry is core/date-sheet.ts; the server renders the texts, the card's head and its details.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bloom } from "@/components/bloom";
import { useFlowerVoice, VoiceBubble } from "@/components/flower-voice";
import { bloomSaying, type FlowerPot, type Stimmung } from "@/core/bloom";
import {
  bubbleDots,
  mixBubble,
  mixPose,
  poseTransform,
  progress,
  release,
  sheetLayout,
  TIMING,
  type Pose,
  type SheetLayout,
  type Tempo,
} from "@/core/date-sheet";
import { cn } from "@/lib/cn";

type Phase = { open: boolean; tempo: Tempo };
type Drag = { startY: number; startTop: number; startedOpen: boolean; moved: boolean; samples: Array<{ y: number; t: number }> };

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
  /** Title, time and place, the calendar chip: what the closed card shows. */
  head: ReactNode;
  /** Map, rows, Route / Verschieben / Absagen: a faded preview while closed. */
  details: ReactNode;
  /** What the happy flower says while the card is closed. */
  saying: string;
  voice: { publicKey: string | null; myDevices: number; partnerDevices: number; partnerName: string };
  bloom: { blaetter: number; welk: number; pot: FlowerPot };
}) {
  const root = useRef<HTMLDivElement>(null);
  const flow = useRef<HTMLDivElement>(null);
  const flower = useRef<HTMLDivElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<SheetLayout | null>(null);
  const [phase, setPhase] = useState<Phase>({ open: false, tempo: "sanft" });
  // While a finger moves the card: its top (px); null = at rest.
  const [dragTop, setDragTop] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);
  const [kick, setKick] = useState(false);
  const [words, setWords] = useState<string | null>(null);
  const [bubbleH, setBubbleH] = useState(60);
  const [reduced, setReduced] = useState(false);
  const drag = useRef<Drag | null>(null);
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
      // The page's header (name, avatars): the open bubble sits in it.
      const header = el.closest("main")?.querySelector("header");
      const headerTop = header ? header.getBoundingClientRect().top - box.top : undefined;
      setLayout(sheetLayout({ width: box.width, height: box.height, flowBottom: textEnd, headerTop }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
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

  /** Moves the flower to `to`; a kick goes through the "mitte" pose with an overshoot. */
  const animateFlower = useCallback(
    (to: Pose, tempo: Tempo, opening: boolean) => {
      const el = flower.current;
      if (!el || !layout || typeof el.animate !== "function") return;
      const from = getComputedStyle(el).transform;
      el.getAnimations().forEach((a) => a.cancel());
      if (reduced) {
        el.animate([{ transform: from === "none" ? undefined : from }, { transform: poseTransform(flat(to)) }], { duration: 200, easing: "ease" });
        return;
      }
      const t = TIMING[tempo];
      const frames: Keyframe[] =
        opening && tempo === "schubs"
          ? [
              { transform: from, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" },
              { transform: poseTransform(layout.mitte.schubs), offset: 0.4, easing: t.ease },
              { transform: poseTransform(to) },
            ]
          : [{ transform: from, easing: t.ease }, { transform: poseTransform(to) }];
      el.animate(frames, { duration: t.ms });
    },
    // flat() only depends on `reduced`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, reduced],
  );

  const settle = useCallback(
    (open: boolean, tempo: Tempo) => {
      if (!layout) return;
      setDragTop(null);
      setPhase({ open, tempo });
      setMoving(open);
      const pool: Stimmung = tempo === "schubs" ? "autsch" : "genervt";
      setWords(open ? bloomSaying(pool, Math.floor(Math.random() * 1000), { partner: voice.partnerName }) : null);
      animateFlower(open ? layout.offen[tempo] : layout.zu, tempo, open);
      if (open && tempo === "schubs" && !reduced) {
        setKick(true);
        window.setTimeout(() => setKick(false), 400);
      }
      // The back gesture closes the open card (one history entry while it is open).
      if (open && !pushed.current) {
        window.history.pushState({ dateSheet: true }, "");
        pushed.current = true;
      }
      if (!open && pushed.current) {
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
      settle(false, "sanft");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [settle]);

  // --- The gesture -------------------------------------------------------------------------------
  const cardTop = !layout ? null : dragTop ?? (phase.open ? layout.cardTopOpen : layout.cardTopZu);

  const start = (y: number) => {
    if (!layout) return;
    drag.current = { startY: y, startTop: cardTop ?? layout.cardTopZu, startedOpen: phase.open, moved: false, samples: [{ y, t: performance.now() }] };
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
    const top = Math.max(layout.cardTopOpen - 30, Math.min(layout.cardTopZu + 30, d.startTop + (y - d.startY)));
    d.samples.push({ y, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
    setDragTop(top);
    return true;
  };
  const end = (): boolean => {
    const d = drag.current;
    drag.current = null;
    if (!d || !layout) return false;
    if (!d.moved) return false;
    const first = d.samples[0];
    const last = d.samples.at(-1)!;
    // Upwards is positive.
    const speed = (first.y - last.y) / Math.max(1, last.t - first.t);
    const p = progress(dragTop ?? d.startTop, layout);
    const { open, tempo } = release(p, d.startedOpen, speed);
    settle(open, tempo);
    return true;
  };

  // A tap toggles (keyboard: Enter / Space on the same button).
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
    settle(!phase.open, "sanft");
  };

  // Inside the open card the content scrolls; at the top, pulling down closes it.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !phase.open) return;
    let from: number | null = null;
    const onStart = (e: TouchEvent) => {
      from = el.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (from === null) return;
      const y = e.touches[0].clientY;
      if (!drag.current) {
        if (y - from < 8) {
          if (y < from) from = null; // scrolling up: the content's turn
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

  // --- What to draw --------------------------------------------------------------------------------
  const p = layout && cardTop !== null ? progress(cardTop, layout) : 0;
  const dragging = dragTop !== null;
  const pose: Pose | null = !layout ? null : dragging ? mixPose(layout.zu, layout.offen.sanft, p) : phase.open ? layout.offen[phase.tempo] : layout.zu;
  const bubble = !layout ? null : dragging ? mixBubble(layout.bubbleZu, layout.bubbleOffen.sanft, p) : phase.open ? layout.bubbleOffen[phase.tempo] : layout.bubbleZu;
  const mood: Stimmung = !moving && !phase.open ? "froh" : dragging || phase.tempo === "sanft" ? "genervt" : "autsch";
  const dots = pose && bubble ? bubbleDots(flat(pose), { x: bubble.x, y: bubble.y, w: bubble.w, h: bubbleH }) : null;
  const glide = dragging ? "none" : `${timing.ms}ms ease`;
  const showVoice = !moving && !phase.open;
  const open = phase.open && !dragging;

  return (
    <div ref={root} data-date-sheet={open ? "offen" : "zu"} data-tempo={phase.tempo} data-moving={moving || phase.open ? "" : undefined} className="relative min-h-0 flex-1">
      <div ref={flow}>
        {headline}
        <div data-sheet-above className="transition-opacity duration-300" style={{ opacity: moving || phase.open ? 0 : 1 }} aria-hidden={moving || phase.open ? true : undefined}>
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
        <>
          <span aria-hidden="true" className="absolute z-[5] size-1.5 rounded-full bg-ink" style={{ left: dots.small.x, top: dots.small.y, transition: `left ${glide}, top ${glide}` }} />
          <span aria-hidden="true" className="absolute z-[5] size-2.5 rounded-full bg-ink" style={{ left: dots.big.x, top: dots.big.y, transition: `left ${glide}, top ${glide}` }} />
          <div
            ref={bubbleEl}
            data-sheet-bubble
            className="absolute z-[5]"
            style={{ left: bubble.x, top: bubble.y, width: bubble.w, transform: `rotate(${reduced ? 0 : bubble.rotate}deg)`, transition: `left ${glide}, top ${glide}, transform ${glide}` }}
          >
            <VoiceBubble
              voice={showVoice ? flowerVoice : { words: words ?? saying, hint: null, sheet: null }}
              className="block w-full rounded-[20px] bg-ink px-2.5 pb-[11px] pt-[9px] text-center font-hand font-semibold leading-[1.02] text-[#1B2620]"
              style={{ fontSize: bubble.fontSize }}
            />
          </div>
        </>
      )}
      {flowerVoice.sheet}

      <div
        data-sheet-card
        className={cn("absolute -inset-x-2 z-[2] flex flex-col overflow-hidden rounded-[26px] bg-surface shadow-[0_-10px_30px_rgba(0,0,0,0.35)]", !layout && "bottom-[-20px] h-[192px]")}
        style={layout && cardTop !== null ? { top: cardTop, bottom: -20, transition: dragging ? "none" : `top ${timing.ms}ms ${timing.cardEase}` } : undefined}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Details schließen" : "Details öffnen"}
          onPointerDown={onHeadPointerDown}
          onPointerMove={(e) => move(e.clientY)}
          onPointerUp={onHeadPointerUp}
          onPointerCancel={onHeadPointerUp}
          onClick={onHeadClick}
          className={cn("absolute inset-x-0 top-0 z-[2] touch-none bg-transparent", open ? "h-[120px]" : "h-full")}
        />
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-[38px] -translate-x-1/2 rounded-sm bg-[#3A4A40]" />
        <div ref={scroller} className={cn("flex min-h-0 flex-1 flex-col gap-2.5 overscroll-contain px-[22px] pb-[18px] pt-6", open ? "overflow-y-auto" : "overflow-hidden")}>
          {head}
          <div
            data-sheet-details
            inert={!open}
            className="flex flex-col gap-2.5"
            style={{
              opacity: open ? 1 : 0.35,
              transform: open ? "none" : "translateY(16px)",
              transition: `opacity 400ms ease ${open ? 250 : 0}ms, transform 400ms ease ${open ? 250 : 0}ms`,
            }}
          >
            {details}
          </div>
        </div>
      </div>
    </div>
  );
}
