"use client";

import { createContext, use, useCallback, useState, type CSSProperties, type ReactNode } from "react";

const COLORS = ["#ff4f8b", "#ffd93d", "#a98bff", "#3ddc97", "#ff9f43", "#4cc3f5"];

export type Piece = { id: number; color: string; dx: number; dy: number; rot: number; round: boolean; delay: number };

/** Random pieces – created in an event handler, never during render. */
export function makePieces(count = 36): Piece[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    color: COLORS[id % COLORS.length],
    dx: Math.round((Math.random() - 0.5) * 360),
    dy: Math.round(-80 - Math.random() * 260),
    rot: Math.round((Math.random() - 0.5) * 720),
    round: Math.random() < 0.4,
    delay: Math.round(Math.random() * 120),
  }));
}

/** A burst of confetti from the middle of the screen. */
export function ConfettiBurst({ pieces }: { pieces: Piece[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="animate-confetti absolute border-[1.5px] border-tinte"
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              width: p.round ? 11 : 9,
              height: p.round ? 11 : 16,
              borderRadius: p.round ? "50%" : 3,
              background: p.color,
              animationDelay: `${p.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

const CelebrationContext = createContext<() => void>(() => {});

/**
 * Lives in the app layout, so the confetti keeps flying even when the button
 * that triggered it disappears (e.g. "Passt!" after confirming).
 */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const celebrate = useCallback(() => {
    setPieces(makePieces());
    setTimeout(() => setPieces(null), 1400);
  }, []);
  return (
    <CelebrationContext value={celebrate}>
      {children}
      {pieces && <ConfettiBurst pieces={pieces} />}
    </CelebrationContext>
  );
}

export function useCelebrate(): () => void {
  return use(CelebrationContext);
}
