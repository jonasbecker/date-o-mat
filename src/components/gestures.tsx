"use client";

// Two iPhone gestures the installed app does not get from the system:
// - From the left edge to the right: back (only where the page has a back arrow, `[data-back]`) – the page
//   follows the finger, past a third of the screen or with a flick it goes.
// - At the top of a page, pull down: the sprout comes down and turns; let go past the mark and the page is
//   fetched fresh (router.refresh).
// The swipe back runs only in the installed app (Safari has its own); `localStorage["dom-gestures"] = "1"`
// switches it on elsewhere (e2e).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SproutIcon } from "./icons";

const EDGE = 24;
const BACK_SHARE = 0.33;
const PULL_MARK = 64;
const PULL_MAX = 110;
/** Where a pull must not start: the date sheet's card, the swipe card, dialogs, text fields. */
const NO_PULL = "[data-sheet-card], [aria-roledescription='Karte'], dialog, input, textarea, select, [data-no-pull]";

function visible(el: Element): boolean {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

function backTarget(main: HTMLElement): HTMLElement | null {
  return [...main.querySelectorAll<HTMLElement>("[data-back]")].find(visible) ?? null;
}

/** Something between the finger and the page is scrolled down: that one scrolls, no pull. */
function scrolledBetween(target: Element, main: HTMLElement): boolean {
  for (let el: Element | null = target; el && el !== main; el = el.parentElement) if (el.scrollTop > 0) return true;
  return main.scrollTop > 0;
}

function swipeBackOn(): boolean {
  try {
    if (localStorage.getItem("dom-gestures") === "1") return true;
  } catch {
    // storage blocked
  }
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type Touch0 = { x: number; y: number; t: number; mode: "back" | "pull" | null; armed: { back: boolean; pull: boolean } };

export function Gestures() {
  const router = useRouter();
  const here = `${usePathname()}?${useSearchParams().toString()}`;
  const [pull, setPull] = useState(0);
  const [fetching, startRefresh] = useTransition();
  // The sprout turns at least a moment, even when the page comes back at once.
  const [spinning, setSpinning] = useState(false);
  const refreshing = fetching || spinning;
  const leaving = useRef<{ at: string; timer: number } | null>(null);

  // The page left to the right waits off screen until the address changes – then the new one is simply there.
  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main[data-screen]");
    if (!main || !leaving.current || leaving.current.at === here) return;
    window.clearTimeout(leaving.current.timer);
    leaving.current = null;
    main.style.transition = "none";
    main.style.transform = "";
  }, [here]);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main[data-screen]");
    if (!main) return;
    let touch: Touch0 | null = null;

    const settle = (transform: string, then?: () => void) => {
      main.style.transition = "transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1)";
      main.style.transform = transform;
      window.setTimeout(() => {
        if (!then) {
          main.style.transition = "";
          if (transform === "" || transform === "none") main.style.transform = "";
        }
        then?.();
      }, 220);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || leaving.current) return;
      const t = e.touches[0];
      const target = e.target as Element;
      // The edge is ours (else the browser's own swipe goes back in the history – even from a tab); only where
      // the page has a back arrow does the page follow the finger.
      const back = t.clientX <= EDGE && swipeBackOn() && !target.closest("dialog");
      const pull = !target.closest(NO_PULL) && !scrolledBetween(target, main);
      touch = back || pull ? { x: t.clientX, y: t.clientY, t: performance.now(), mode: null, armed: { back, pull } } : null;
    };

    const onMove = (e: TouchEvent) => {
      if (!touch) return;
      const t = e.touches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      if (!touch.mode) {
        if (touch.armed.back && dx > 10 && Math.abs(dx) > Math.abs(dy)) touch.mode = "back";
        else if (touch.armed.pull && dy > 8 && Math.abs(dy) > Math.abs(dx)) touch.mode = "pull";
        else if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          touch = null;
          return;
        } else return;
      }
      e.preventDefault();
      main.style.transition = "none";
      if (touch.mode === "back") {
        if (backTarget(main)) main.style.transform = `translateX(${Math.max(0, dx)}px)`;
      } else {
        // Rubber band: harder the further it goes.
        const p = Math.min(PULL_MAX, dy * 0.5);
        setPull(p);
        main.style.transform = `translateY(${p * 0.6}px)`;
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!touch?.mode) {
        touch = null;
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.x;
      const dy = t.clientY - touch.y;
      const speed = dx / Math.max(1, performance.now() - touch.t);
      if (touch.mode === "back") {
        const target = backTarget(main);
        if (target && (dx > window.innerWidth * BACK_SHARE || (speed > 0.5 && dx > 40))) {
          settle(`translateX(${window.innerWidth}px)`, () => {
            target.click();
            // A step inside the page (a button) is there at once; a link waits for the new address.
            const done = () => {
              leaving.current = null;
              main.style.transition = "none";
              main.style.transform = "";
            };
            if (target.tagName !== "A") return done();
            leaving.current = { at: here, timer: window.setTimeout(done, 3000) };
          });
        } else settle("");
      } else {
        const p = Math.min(PULL_MAX, dy * 0.5);
        settle("");
        if (p >= PULL_MARK) {
          setPull(PULL_MARK);
          setSpinning(true);
          window.setTimeout(() => setSpinning(false), 600);
          startRefresh(() => router.refresh());
        } else setPull(0);
      }
      touch = null;
    };

    main.addEventListener("touchstart", onStart, { passive: true });
    main.addEventListener("touchmove", onMove, { passive: false });
    main.addEventListener("touchend", onEnd);
    main.addEventListener("touchcancel", onEnd);
    return () => {
      main.removeEventListener("touchstart", onStart);
      main.removeEventListener("touchmove", onMove);
      main.removeEventListener("touchend", onEnd);
      main.removeEventListener("touchcancel", onEnd);
    };
  }, [router, here]);

  // The refresh is done: the sprout goes back up.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follows the transition's end
    if (!refreshing && pull === PULL_MARK) setPull(0);
  }, [refreshing, pull]);

  const shown = pull > 0 || refreshing;
  return (
    <div
      aria-hidden="true"
      data-pull={refreshing ? "refreshing" : pull > 0 ? "pulling" : undefined}
      className="pointer-events-none fixed left-1/2 top-[max(env(safe-area-inset-top),8px)] z-40 flex size-10 items-center justify-center rounded-full bg-surface text-green shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
      style={{
        transform: `translate(-50%, ${shown ? Math.max(pull, refreshing ? PULL_MARK : 0) - 48 : -60}px) rotate(${pull * 3}deg) scale(${shown ? Math.min(1, 0.4 + pull / PULL_MARK) : 0.4})`,
        opacity: shown ? Math.min(1, pull / 30 + (refreshing ? 1 : 0)) : 0,
        transition: pull > 0 && !refreshing ? "none" : "transform 250ms ease, opacity 250ms ease",
      }}
    >
      <SproutIcon width={20} height={20} className={refreshing ? "animate-bob" : undefined} />
    </div>
  );
}
