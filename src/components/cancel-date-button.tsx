"use client";

import { useState, useTransition } from "react";
import { Button } from "./button";

/** "Absagen" with a confirmation step – the other one hears about it (push; Google too). */
export function CancelDateButton({ action, partnerName }: { action: () => Promise<{ ok: boolean }>; partnerName: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="min-h-11 text-sm font-extrabold text-muted underline">
        Absagen
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-himbeere-soft p-3 text-tinte">
      <p className="text-sm font-bold">
        {failed ? "Das ging nicht – das Date wurde inzwischen geändert oder schon abgesagt." : `Wirklich absagen? ${partnerName} bekommt Bescheid.`}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Nein
        </Button>
        <Button size="sm" disabled={pending} onClick={() =>
            startTransition(async () => {
              const result = await action().catch(() => ({ ok: false }));
              setFailed(!result.ok);
            })
          }>
          {pending ? "Sagt ab …" : "Ja, absagen"}
        </Button>
      </div>
    </div>
  );
}
