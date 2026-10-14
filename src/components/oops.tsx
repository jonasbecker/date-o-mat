import type { ReactNode } from "react";
import { LogoMark } from "./logo";

/** Full-screen friendly message: 404, errors, offline. */
export function Oops({ emoji, title, children, actions }: { emoji: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="relative">
        <LogoMark size={96} clipId="oops-globe" />
        <span className="absolute -right-4 -top-2 text-4xl" aria-hidden="true">
          {emoji}
        </span>
      </div>
      <h1 className="font-display text-4xl font-semibold">{title}</h1>
      <div className="font-semibold text-muted">{children}</div>
      <div className="flex w-full flex-col gap-3">{actions}</div>
    </main>
  );
}
