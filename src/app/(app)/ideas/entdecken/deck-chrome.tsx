"use client";

// The swipe page's controls outside the card: ⓘ next to the Matchlinge pill (how it works, the count, more
// ideas, "Euer Ding") and ↺ next to the filter. The deck (swipe-deck.tsx) shares its state through
// DeckChrome, so nothing has to sit as small text under the card any more.
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { UndoIcon } from "@/components/icons";
import { Sheet, type SheetHandle } from "@/components/sheet";

export type DeckControls = {
  swiped: number;
  left: number;
  canUndo: boolean;
  undo: () => void;
  /** Null without the AI (no "Mehr Ideen"). */
  more: (() => void) | null;
  loading: boolean;
};

const Ctx = createContext<{ controls: DeckControls | null; set: (c: DeckControls) => void } | null>(null);

export function DeckChrome({ children }: { children: React.ReactNode }) {
  const [controls, set] = useState<DeckControls | null>(null);
  return <Ctx.Provider value={{ controls, set }}>{children}</Ctx.Provider>;
}

/** The deck tells the buttons what it can do. */
export function useShareDeck(controls: DeckControls) {
  const ctx = useContext(Ctx);
  const latest = useRef(controls);
  useEffect(() => {
    latest.current = controls;
  });
  const { swiped, left, canUndo, loading } = controls;
  const hasMore = controls.more !== null;
  useEffect(() => {
    ctx?.set({ swiped, left, canUndo, loading, undo: () => latest.current.undo(), more: hasMore ? () => latest.current.more?.() : null });
    // ctx.set is a state setter – stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swiped, left, canUndo, loading, hasMore]);
}

/** ↺ – takes back the last swipe (also Backspace). */
export function DeckUndoButton() {
  const controls = useContext(Ctx)?.controls;
  return (
    <button
      type="button"
      aria-label="Rückgängig"
      onClick={() => controls?.undo()}
      disabled={!controls?.canUndo}
      className="tap flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink disabled:opacity-35"
    >
      <UndoIcon width={18} height={18} />
    </button>
  );
}

/** ⓘ – how swiping works, how far you are, more ideas, what you two like. */
export function DeckInfoButton({ partnerName, taste }: { partnerName: string; taste: string[] }) {
  const controls = useContext(Ctx)?.controls;
  const sheet = useRef<SheetHandle>(null);
  return (
    <>
      <button
        type="button"
        aria-label="So geht Swipen"
        onClick={() => sheet.current?.open()}
        className="tap flex size-8 shrink-0 items-center justify-center rounded-full bg-surface font-display text-[15px] font-bold italic text-ink"
      >
        i
      </button>
      <Sheet ref={sheet} title="So geht Swipen">
        <ul className="flex flex-col gap-2.5 text-[15px] leading-snug">
          <li>
            <b>Rechts wischen = einpflanzen:</b> die Idee landet auf eurer Wunschliste.
          </li>
          <li>
            <b>Links wischen = Kompost:</b> weg damit.
          </li>
          <li>
            Wischt {partnerName} auch rechts, <b>keimt’s</b> – ein Match, das ihr direkt planen könnt.
          </li>
          <li>Die Blume antippen: noch ein Spruch. Vertippt? ↺ oben neben dem Filter.</li>
        </ul>
        <p data-swipe-progress className="font-mono text-[13px] text-muted">
          {controls?.swiped ?? 0} geswipt · {controls?.left ?? 0} übrig
        </p>
        {controls?.more && (
          <Button
            variant="secondary"
            disabled={controls.loading}
            onClick={() => {
              controls.more?.();
              sheet.current?.close();
            }}
          >
            {controls.loading ? "Neue Ideen werden gemischt …" : "✨ Mehr Ideen holen"}
          </Button>
        )}
        {taste.length > 0 && (
          <Link href="/story" className="text-sm text-muted underline">
            Euer Ding: {taste.join(" · ")}
          </Link>
        )}
      </Sheet>
    </>
  );
}
