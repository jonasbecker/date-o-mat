"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/button";
import { LogoLockup } from "@/components/logo";
import { cn } from "@/lib/cn";
import { finishOnboardingAction } from "./actions";

export type Slide = { emoji: string; title: string; text: string; tone: string };

/** Swipeable intro cards (scroll-snap), with dots and a "Weiter" button. */
export function WelcomeSlides({ slides }: { slides: Slide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  function goTo(next: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center justify-between">
        <LogoLockup clipId="welcome-logo" />
        <form action={finishOnboardingAction}>
          <button type="submit" className="text-sm font-extrabold text-muted underline">
            Überspringen
          </button>
        </form>
      </div>

      <div
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="-mx-5 flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        aria-roledescription="Karussell"
      >
        {slides.map((slide, i) => (
          <section
            key={slide.title}
            aria-label={`${i + 1} von ${slides.length}`}
            aria-hidden={i !== index}
            className="flex w-full shrink-0 snap-center px-5"
          >
            <div className={cn("sticker flex flex-1 flex-col items-center justify-center gap-5 rounded-[32px] p-7 text-center text-ink", slide.tone)}>
              <span className="text-7xl" aria-hidden="true">
                {slide.emoji}
              </span>
              <h1 className="text-[32px] font-bold leading-tight">{slide.title}</h1>
              <p className="text-lg font-semibold">{slide.text}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-center gap-2" aria-hidden="true">
        {slides.map((slide, i) => (
          <button
            key={slide.title}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(i)}
            className={cn("h-2.5 rounded-full border-2 border-line transition-all", i === index ? "w-7 bg-himbeere" : "w-2.5 bg-surface")}
          />
        ))}
      </div>

      {last ? (
        <form action={finishOnboardingAction}>
          <Button type="submit" size="lg" className="w-full">
            Los geht&apos;s 🎉
          </Button>
        </form>
      ) : (
        <Button size="lg" className="w-full" onClick={() => goTo(index + 1)}>
          Weiter
        </Button>
      )}
    </div>
  );
}
