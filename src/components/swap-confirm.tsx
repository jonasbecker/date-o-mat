"use client";

import { useState, useTransition } from "react";
import { swapDateIdeaAction } from "@/app/(app)/ideas/actions";
import type { IdeaSize } from "@/lib/domain";
import { Button } from "./button";

/** The next date – an idea can take its place. */
export type NextDateInfo = { id: string; title: string; when: string; size: IdeaSize };

/** "Willst du das ändern?" before an idea takes the place of the next date (the time stays). */
export function SwapConfirm({
  next,
  idea,
  onCancel,
  onDone,
}: {
  next: NextDateInfo;
  idea: { id: string; title: string; size?: IdeaSize };
  onCancel: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-[20px] bg-zitrone-soft px-4 py-3 text-tinte">
        <p className="text-[13px] font-extrabold">Euer nächstes Date</p>
        <p className="font-display text-lg font-semibold leading-snug">{next.title}</p>
        <p className="text-sm font-bold">{next.when}</p>
      </div>
      <p className="font-bold">
        Willst du das ändern? Dann macht ihr stattdessen „{idea.title}“ – der Termin bleibt.
        {idea.size === "large" && next.size === "small" && <span className="mt-1 block text-sm text-muted">Das ist eher was Langes – euer Termin ist kürzer.</span>}
      </p>
      {message && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
          {message}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Nein
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await swapDateIdeaAction(next.id, idea.id).catch(() => ({ ok: false, message: "Das hat nicht geklappt – bist du offline?" }));
              if (!result.ok) return setMessage(result.message ?? "Das hat nicht geklappt.");
              onDone();
            })
          }
        >
          {pending ? "Wird geändert …" : "Ja, ändern"}
        </Button>
      </div>
    </div>
  );
}
