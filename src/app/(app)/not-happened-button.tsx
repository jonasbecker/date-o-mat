"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/button";

/** "„X“ hat doch nicht geklappt?" – asks once more, it takes the leaf away. */
export function NotHappenedButton({ title, action }: { title: string; action: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="min-h-11 self-center text-sm font-semibold text-muted underline">
        „{title}“ hat doch nicht geklappt?
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
      <p className="text-sm font-bold">Dann zählt „{title}“ nicht als Date – kein Blatt dafür. Sicher?</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Doch, war schön
        </Button>
        <Button size="sm" disabled={pending} onClick={() => startTransition(() => action())}>
          {pending ? "Moment …" : "Ja, hat nicht geklappt"}
        </Button>
      </div>
    </div>
  );
}
