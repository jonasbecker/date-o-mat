"use client";

import { useState, useTransition } from "react";
import { Button } from "./button";

/** "Absagen" with a confirmation step – the guest gets a cancellation from Google. */
export function CancelDateButton({ action, partnerName }: { action: () => Promise<{ ok: boolean }>; partnerName: string }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm font-extrabold text-muted underline">
        Absagen
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-himbeere-soft p-3 text-tinte">
      <p className="text-sm font-bold">Wirklich absagen? {partnerName} bekommt eine Absage über Google Kalender.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAsking(false)} disabled={pending}>
          Nein
        </Button>
        <Button size="sm" disabled={pending} onClick={() => startTransition(async () => void (await action()))}>
          {pending ? "Sagt ab …" : "Ja, absagen"}
        </Button>
      </div>
    </div>
  );
}
