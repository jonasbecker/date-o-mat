"use client";

import { useRef, useState } from "react";
import { createIdeaAction } from "@/app/(app)/ideas/actions";
import { PlusIcon } from "./icons";
import { IdeaForm } from "./idea-form";
import { Sheet, type SheetHandle } from "./sheet";

/** The yellow "+" in the navigation: capture an idea from any screen. */
export function QuickAdd() {
  const sheet = useRef<SheetHandle>(null);
  const [toast, setToast] = useState(false);
  // Remounting the form after each save resets it completely (fields, size, details).
  const [formKey, setFormKey] = useState(0);

  function saved() {
    sheet.current?.close();
    setFormKey((key) => key + 1);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  return (
    <>
      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          aria-label="Idee hinzufügen"
          onClick={() => sheet.current?.open()}
          className="press -mt-8 flex size-[60px] items-center justify-center rounded-full border-[2.5px] border-line bg-zitrone text-tinte shadow-[3px_3px_0_var(--line)]"
        >
          <PlusIcon width={28} height={28} />
        </button>
        <span aria-hidden="true" className="text-[11px] font-extrabold text-muted">
          Idee
        </span>
      </div>

      <Sheet ref={sheet} title="Neue Idee">
        <IdeaForm key={formKey} action={createIdeaAction} onSaved={saved} footnote="Enter speichert · ihr seht sie beide sofort" />
      </Sheet>

      <div
        role="status"
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-5"
      >
        {toast && (
          <span className="sticker animate-pop-in rounded-full bg-minze px-5 py-2.5 font-display text-lg font-semibold text-tinte">
            Auf eurer Wunschliste! 💡
          </span>
        )}
      </div>
    </>
  );
}
