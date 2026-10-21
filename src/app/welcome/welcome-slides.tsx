"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/button";
import { IosInstallGuide, PushDeniedHelp } from "@/components/ios-install-guide";
import { LogoLockup } from "@/components/logo";
import { usePush } from "@/components/use-push";
import { cn } from "@/lib/cn";
import { finishOnboardingAction } from "./actions";

export type Slide = { emoji: string; title: string; text: string; tone: string; /** The slide that turns reminders on. */ push?: boolean };

/** The reminders card: one tap asks for permission and registers this device. */
function PushSlideAction({ push }: { push: ReturnType<typeof usePush> }) {
  if (push.support === null) return <div className="h-12 w-full animate-pulse rounded-2xl bg-track/60" />;
  if (push.subscription) return <p className="text-xl font-bold">🔔 Erinnerungen sind an</p>;
  if (push.permission === "denied") return <PushDeniedHelp />;
  if (push.support === "ios-browser") return <IosInstallGuide />;
  if (push.support === "unsupported") return <p className="text-sm font-bold">Dieser Browser kann keine Erinnerungen schicken.</p>;
  return (
    <div className="flex w-full flex-col gap-2">
      <Button size="lg" className="w-full" onClick={push.enable} disabled={push.pending}>
        🔔 Erinnerungen an
      </Button>
      {push.message && (
        <p role="status" className="text-sm font-bold">
          {push.message}
        </p>
      )}
    </div>
  );
}

/** Swipeable intro cards (scroll-snap), with dots and a "Weiter" button. */
export function WelcomeSlides({ slides, publicKey }: { slides: Slide[]; publicKey: string | null }) {
  const push = usePush(publicKey);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;

  function goTo(next: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex items-center justify-between">
        <LogoLockup />
        <form action={finishOnboardingAction}>
          <button type="submit" className="text-sm font-semibold text-muted underline">
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
        className="-mx-5 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        aria-roledescription="Karussell"
      >
        {slides.map((slide, i) => (
          <section
            key={slide.title}
            aria-label={`${i + 1} von ${slides.length}`}
            aria-hidden={i !== index}
            className="flex w-full shrink-0 snap-center px-5"
          >
            {/* The buttons below always stay on screen: a slide too long for a small phone scrolls inside its card. */}
            <div className={cn("flex flex-1 flex-col items-center justify-center-safe gap-5 overflow-y-auto rounded-[30px] p-7 text-center text-ink", slide.tone)}>
              <span className="text-7xl" aria-hidden="true">
                {slide.emoji}
              </span>
              <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.035em]">{slide.title}</h1>
              <p className="text-lg">{slide.text}</p>
              {slide.push && publicKey && <PushSlideAction push={push} />}
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
            className={cn("h-1.5 rounded-[3px] bg-ink transition-[width,opacity] duration-200", i === index ? "w-[22px]" : "w-1.5 opacity-35")}
          />
        ))}
      </div>

      {last ? (
        // Without reminders the way out is a small "Später" – with them (or if there is nothing to turn on) the big button.
        slides[index].push && publicKey && !push.subscription && push.support !== "unsupported" ? (
          <form action={finishOnboardingAction} className="flex justify-center">
            <button type="submit" className="text-sm font-semibold text-muted underline">
              Später
            </button>
          </form>
        ) : (
          <form action={finishOnboardingAction}>
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Los geht&apos;s 🎉
            </Button>
          </form>
        )
      ) : (
        <Button size="lg" className="w-full" onClick={() => goTo(index + 1)}>
          Weiter
        </Button>
      )}
    </div>
  );
}
