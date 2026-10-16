"use client";

import { useRef, useState } from "react";
import { createIdeaAction } from "@/app/(app)/ideas/actions";
import { PlusIcon } from "./icons";
import { IdeaForm } from "./idea-form";
import { Sheet, type SheetHandle } from "./sheet";

/** "+ Idee" in the Ideen tab: capture an idea in a sheet. */
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
      <button type="button" aria-label="Idee hinzufügen" onClick={() => sheet.current?.open()} className="sticker press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-zitrone px-4 font-display text-[15px] font-semibold text-tinte">
        <PlusIcon width={18} height={18} /> Idee
      </button>

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
