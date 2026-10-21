"use client";

import { useState, useTransition } from "react";

/**
 * A quiet text button for something that cannot be taken back: the first tap asks, the second does it.
 * `action` is a server action (it refreshes the page itself).
 */
export function ConfirmButton({ label, question, yes, action, className }: { label: string; question: string; yes: string; action: () => Promise<unknown>; className?: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={className ?? "text-muted underline"}>
        {label}
      </button>
    );
  }
  return (
    <span className="flex basis-full flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-bold">{question}</span>
      <button type="button" disabled={pending} onClick={() => start(async () => void (await action()))} className="font-extrabold text-like underline disabled:opacity-50">
        {pending ? "Moment …" : yes}
      </button>
      <button type="button" disabled={pending} onClick={() => setAsking(false)} className="text-muted underline">
        Nein
      </button>
    </span>
  );
}
