"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveCuratedAction, surpriseAction, type SurpriseView } from "@/app/(app)/ideas/inspiration-actions";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "./button";
import { Sheet, type SheetHandle } from "./sheet";
import { SizeChip } from "./size-chip";

/** "Überrasch uns": draws a random idea, shown like a gumball falling out of the machine. */
export function SurpriseButton({ className, variant = "secondary" }: { className?: string; variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const sheet = useRef<SheetHandle>(null);
  const [pick, setPick] = useState<SurpriseView | null>(null);
  const [empty, setEmpty] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [drawing, startDraw] = useTransition();
  const [busy, startBusy] = useTransition();

  function draw() {
    startDraw(async () => {
      // A short pause makes the draw feel like a draw.
      const [result] = await Promise.all([surpriseAction(recent), new Promise((r) => setTimeout(r, 650))]);
      setPick(result);
      setEmpty(result === null);
      setSaved(false);
      if (result) setRecent((keys) => [result.key, ...keys].slice(0, 8));
    });
  }

  function open() {
    sheet.current?.open();
    draw();
  }

  function planIt() {
    if (!pick) return;
    startBusy(async () => {
      const ideaId = pick.ideaId ?? (pick.curatedId ? (await saveCuratedAction(pick.curatedId)).ideaId : null);
      if (ideaId) router.push(`/plan?idea=${ideaId}`);
    });
  }

  return (
    <>
      <button type="button" onClick={open} className={buttonClass(variant, "md", cn("w-full", className))}>
        🎲 Überrasch uns
      </button>
      <Sheet ref={sheet} title="Der Date-O-Mat zieht …">
        <div aria-live="polite" className="flex min-h-56 flex-col gap-4">
          {drawing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
              <span className="animate-spin text-6xl [animation-duration:700ms]" aria-hidden="true">
                🍬
              </span>
              <p className="font-display text-lg font-semibold">Kurbel dreht sich …</p>
            </div>
          ) : empty ? (
            <p className="font-bold">Gerade gibt es nichts zu ziehen – setzt ein paar Ideen auf die Wunschliste.</p>
          ) : (
            pick && (
              <div className="animate-pop-in flex flex-col gap-3 rounded-[22px] border-[2.5px] border-line bg-zitrone-soft p-4 text-tinte">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-2xl font-semibold leading-tight">{pick.title}</h3>
                  <SizeChip size={pick.size} className="mt-1 shrink-0" />
                </div>
                {pick.meta && <p className="text-sm font-extrabold">{pick.meta}</p>}
                {pick.note && <p className="font-semibold">{pick.note}</p>}
                <p className="text-xs font-extrabold uppercase tracking-wide">{pick.ideaId ? "Von eurer Wunschliste" : "Köln-Tipp vom Date-O-Mat"}</p>
              </div>
            )
          )}
          {pick && !drawing && (
            <div className="flex flex-col gap-2.5">
              <Button size="md" className="w-full" disabled={busy} onClick={planIt}>
                Damit planen
              </Button>
              <div className="flex gap-2.5">
                <Button variant="secondary" size="sm" className="flex-1" onClick={draw}>
                  Nochmal ziehen
                </Button>
                {pick.curatedId && !pick.ideaId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    disabled={saved || busy}
                    onClick={() => startBusy(async () => void (await saveCuratedAction(pick.curatedId!), setSaved(true)))}
                  >
                    {saved ? "✓ Gemerkt" : "Merken"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
