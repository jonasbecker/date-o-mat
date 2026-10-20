"use client";

import { useId, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";

export type SheetHandle = { open: () => void; close: () => void };

/**
 * Bottom sheet built on the native <dialog>: focus trap, Escape and backdrop
 * come from the browser. The element marked `data-autofocus` is focused
 * synchronously on open, so phones show the keyboard right away.
 */
export function Sheet({
  ref,
  title,
  onClose,
  children,
}: {
  ref: Ref<SheetHandle>;
  title: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    },
    close() {
      dialogRef.current?.close();
    },
  }));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (event.target === dialogRef.current) dialogRef.current.close();
      }}
      className="mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-md bg-transparent p-0 text-ink backdrop:bg-tinte/45 open:animate-sheet-up"
    >
      <div className="flex max-h-[92dvh] flex-col gap-4 overflow-y-auto rounded-t-[28px] border-0 bg-surface px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-2.5">
        <span aria-hidden="true" className="mx-auto h-[5px] w-11 shrink-0 rounded-full bg-track" />
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-[23px] font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => dialogRef.current?.close()}
            className="flex size-10 items-center justify-center rounded-full bg-bg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
