"use client";

import { useState, useTransition } from "react";
import { nudgeAction } from "@/app/(app)/actions";
import { Button } from "./button";

/** "Anstupsen" on the Beet: one push to whoever has the watering can (at most once an hour). */
export function NudgeButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await nudgeAction();
            setMessage(result.message ?? null);
          })
        }
      >
        {pending ? "Stupst …" : "Anstupsen"}
      </Button>
      {message && (
        <p role="status" className="animate-pop-in text-sm text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
