"use client";

import { useEffect, type ReactNode } from "react";

/** A collapsed settings section; opens by itself when the page is opened with its #id. */
export function Fold({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-6 rounded-[24px] border-[2.5px] border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex flex-col">
          <span className="font-display text-lg font-semibold">{title}</span>
          {hint && <span className="text-sm font-semibold text-muted">{hint}</span>}
        </span>
        <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="border-t-2 border-track px-5 py-4">{children}</div>
    </details>
  );
}

/** Links like /settings#budget open the matching section. */
export function OpenFromHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target instanceof HTMLDetailsElement && !target.open) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
