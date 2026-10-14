"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/button";
import type { Slide } from "@/core/story";
import { cn } from "@/lib/cn";

const TONE: Record<Slide["kind"], string> = {
  intro: "bg-himbeere",
  count: "bg-zitrone",
  favorite: "bg-lavendel",
  hearts: "bg-himbeere-soft",
  rhythm: "bg-minze",
  sizes: "bg-zitrone-soft",
  money: "bg-mandarine",
  taste: "bg-himmel",
  photos: "bg-minze-soft",
  outro: "bg-himbeere",
  empty: "bg-zitrone-soft",
};

function Big({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-[64px] font-bold leading-none">{children}</p>;
}

function SlideBody({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "intro":
      return (
        <>
          <span className="text-7xl" aria-hidden="true">
            💞
          </span>
          <p className="text-lg font-extrabold uppercase tracking-wide">Eure Date-Story</p>
          <Big>{slide.year}</Big>
          <p className="text-xl font-bold">
            {slide.names[0]} & {slide.names[1]}
          </p>
        </>
      );
    case "count":
      return (
        <>
          <p className="text-xl font-bold">Ihr hattet</p>
          <Big>{slide.dates}</Big>
          <p className="text-2xl font-bold">{slide.dates === 1 ? "Date" : "Dates"}</p>
          <p className="text-lg font-semibold">– das sind rund {slide.hours} Stunden nur für euch zwei ⏳</p>
        </>
      );
    case "favorite":
      return (
        <>
          <p className="text-xl font-bold">🏆 Euer Lieblingsdate</p>
          {slide.photoId && (
            // eslint-disable-next-line @next/next/no-img-element -- private photo, served by our own route
            <img src={`/api/photos/${slide.photoId}?size=thumb`} alt="" className="sticker aspect-square w-48 rounded-[22px] object-cover" />
          )}
          <p className="font-display text-4xl font-bold leading-tight">{slide.title}</p>
          <p className="text-xl font-bold">{"❤️".repeat(Math.round(slide.hearts))} ({slide.hearts.toLocaleString("de-DE")})</p>
        </>
      );
    case "hearts":
      return (
        <>
          <p className="text-xl font-bold">Im Schnitt gab&apos;s</p>
          <Big>{slide.average.toLocaleString("de-DE")} ❤️</Big>
          <p className="text-lg font-semibold">bei {slide.rated} bewerteten Dates</p>
        </>
      );
    case "rhythm":
      return (
        <>
          <p className="text-xl font-bold">Euer Date-Monat</p>
          <Big>{slide.topMonth}</Big>
          <p className="text-lg font-semibold">
            mit {slide.topMonthDates} {slide.topMonthDates === 1 ? "Date" : "Dates"}
          </p>
          <p className="mt-4 text-xl font-bold">Und euer Lieblingstag: {slide.weekday} 📅</p>
        </>
      );
    case "sizes":
      return (
        <>
          <p className="text-xl font-bold">Kurz oder lang?</p>
          <div className="flex gap-8">
            <p className="flex flex-col items-center">
              <span className="text-5xl" aria-hidden="true">
                ☕
              </span>
              <span className="font-display text-5xl font-bold">{slide.short}</span>
              <span className="font-bold">kurze</span>
            </p>
            <p className="flex flex-col items-center">
              <span className="text-5xl" aria-hidden="true">
                🎡
              </span>
              <span className="font-display text-5xl font-bold">{slide.long}</span>
              <span className="font-bold">lange</span>
            </p>
          </div>
        </>
      );
    case "money":
      return (
        <>
          <p className="text-xl font-bold">Für eure Dates habt ihr ausgegeben</p>
          <Big>{slide.total} €</Big>
          <p className="text-lg font-semibold">im Schnitt {slide.perDate} € pro Date</p>
          {slide.pot !== null && <p className="mt-4 text-xl font-bold">🎁 Im Spartopf: {slide.pot} €</p>}
        </>
      );
    case "taste":
      return (
        <>
          <p className="text-xl font-bold">Euer Ding beim Swipen</p>
          {slide.themes.length > 0 ? (
            <ul className="flex flex-col gap-1 font-display text-3xl font-bold">
              {slide.themes.map((t, i) => (
                <li key={t}>
                  {i + 1}. {t}
                </li>
              ))}
            </ul>
          ) : (
            <Big>{slide.swipes}</Big>
          )}
          <p className="text-lg font-semibold">
            {slide.swipes} Swipes · {slide.matches} {slide.matches === 1 ? "Match" : "Matches"} 💞
          </p>
          {slide.rightSwiper && (
            <p className="mt-2 text-lg font-bold">
              {slide.rightSwiper.name} wischt öfter nach rechts ({slide.rightSwiper.percent} %) 😄
            </p>
          )}
        </>
      );
    case "photos":
      return (
        <>
          <p className="text-xl font-bold">
            {slide.count} {slide.count === 1 ? "Foto" : "Fotos"} 📸
          </p>
          <div className="grid grid-cols-3 gap-2">
            {slide.photoIds.map((id) => (
              // eslint-disable-next-line @next/next/no-img-element -- private photo, served by our own route
              <img key={id} src={`/api/photos/${id}?size=thumb`} alt="" className="aspect-square w-24 rounded-[16px] border-2 border-tinte object-cover" />
            ))}
          </div>
        </>
      );
    case "outro":
      return (
        <>
          <span className="text-7xl" aria-hidden="true">
            🥂
          </span>
          <p className="font-display text-4xl font-bold">Auf {slide.year + 1}!</p>
          <p className="text-lg font-semibold">Noch mehr Dates, noch mehr Herzen.</p>
          <Link href="/plan" className={buttonClass("secondary", "md", "mt-2")}>
            Nächstes Date planen
          </Link>
        </>
      );
    case "empty":
      return (
        <>
          <span className="text-6xl" aria-hidden="true">
            🌱
          </span>
          <p className="font-display text-3xl font-bold">{slide.year} fängt gerade erst an</p>
          <p className="text-lg font-semibold">Nach euren ersten Dates erzählt euch der Date-O-Mat hier eure Geschichte.</p>
        </>
      );
  }
}

/** Tap right (or →) for the next slide, left (or ←) for the previous one. */
export function StoryViewer({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const slide = slides[Math.min(index, slides.length - 1)];
  const next = () => setIndex((i) => Math.min(i + 1, slides.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keys.current = (e) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-ink" : "bg-track")} />
        ))}
      </div>
      <section
        aria-roledescription="Folie"
        aria-label={`${index + 1} von ${slides.length}`}
        aria-live="polite"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a, button")) return;
          const box = e.currentTarget.getBoundingClientRect();
          if (e.clientX - box.left < box.width / 3) prev();
          else next();
        }}
        className={cn("sticker relative flex min-h-[520px] cursor-pointer select-none flex-col items-center justify-center gap-4 rounded-[28px] px-6 py-10 text-center text-tinte", TONE[slide.kind])}
      >
        <SlideBody slide={slide} />
      </section>
      <div className="flex items-center justify-between">
        <button type="button" onClick={prev} disabled={index === 0} className="text-sm font-extrabold underline disabled:opacity-30">
          ← Zurück
        </button>
        <span className="text-sm font-bold text-muted">
          {index + 1} / {slides.length}
        </span>
        <button type="button" onClick={next} disabled={index === slides.length - 1} className="text-sm font-extrabold underline disabled:opacity-30">
          Weiter →
        </button>
      </div>
    </div>
  );
}
