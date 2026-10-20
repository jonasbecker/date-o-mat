"use client";

import { useRef, useState } from "react";
import { createIdeaAction } from "@/app/(app)/ideas/actions";
import { PlusIcon } from "./icons";
import { IdeaForm } from "./idea-form";
import { Sheet, type SheetHandle } from "./sheet";

/**
 * "+ neue Idee": capture an idea in a sheet. `look="link"` is the quiet text version (MPlan),
 * `look="field"` the field on the ideas page (MIdeen) – what is typed there starts the idea.
 */
export function QuickAdd({ look = "pill" }: { look?: "pill" | "link" | "field" }) {
  const sheet = useRef<SheetHandle>(null);
  const [toast, setToast] = useState(false);
  // Remounting the form after each save resets it completely (fields, size, details).
  const [formKey, setFormKey] = useState(0);
  const [typed, setTyped] = useState("");
  const [start, setStart] = useState<{ title?: string; link?: string }>({});

  function openWithTyped() {
    const text = typed.trim();
    setStart(/^https?:\/\//i.test(text) ? { link: text } : { title: text || undefined });
    setFormKey((key) => key + 1);
    sheet.current?.open();
  }

  function saved() {
    sheet.current?.close();
    setTyped("");
    setStart({});
    setFormKey((key) => key + 1);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  return (
    <>
      {look === "field" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            openWithTyped();
          }}
          className="flex h-[52px] items-center gap-2 rounded-[18px] bg-surface pl-4 pr-1"
        >
          <label htmlFor="quick-idea" className="sr-only">
            Neue Idee
          </label>
          <input
            id="quick-idea"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={500}
            placeholder="Eigenen Samen einpflanzen …"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
          <button type="submit" aria-label="Idee hinzufügen" className="press flex size-[42px] shrink-0 items-center justify-center rounded-full bg-cta text-bg">
            <PlusIcon width={20} height={20} />
          </button>
        </form>
      ) : look === "link" ? (
        <button type="button" aria-label="Idee hinzufügen" onClick={() => sheet.current?.open()} className="tap shrink-0 py-2 text-sm font-bold">
          + neue Idee
        </button>
      ) : (
        <button type="button" aria-label="Idee hinzufügen" onClick={() => sheet.current?.open()} className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-ink px-3.5 text-sm font-bold text-bg">
          <PlusIcon width={16} height={16} /> Idee
        </button>
      )}

      <Sheet ref={sheet} title="Neue Idee">
        <IdeaForm key={formKey} action={createIdeaAction} onSaved={saved} initialTitle={start.title} initialLink={start.link} footnote="Enter speichert · ihr seht sie beide sofort" />
      </Sheet>

      <div role="status" className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),16px)] z-50 flex justify-center px-5">
        {toast && <span className="animate-pop-in rounded-full bg-ink px-5 py-2.5 text-base font-bold text-bg shadow-lg">Auf eurer Wunschliste!</span>}
      </div>
    </>
  );
}
