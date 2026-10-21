"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** A link inside the app that the router will follow (not a new tab, a download or a modifier click). */
function internalLink(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const a = (event.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute("download")) return false;
  const url = new URL(a.href);
  return url.origin === location.origin && url.pathname + url.search !== location.pathname + location.search;
}

/**
 * A tab switch keeps the old page until the new one is there (one loading boundary in the (app) layout), so a
 * tap needs an answer of its own: a thin bar at the top while the next page is on its way – only if that takes
 * a moment (150 ms), it goes once the address changes.
 */
export function NavPending() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [waiting, setWaiting] = useState<{ at: string } | null>(null);
  const [shown, setShown] = useState(false);
  const here = `${path}?${search}`;

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (internalLink(event)) setWaiting({ at: `${location.pathname}?${location.search.replace(/^\?/, "")}` });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const show = window.setTimeout(() => setShown(true), 150);
    // Never stuck: a navigation that fails or is cancelled ends the bar after a while.
    const giveUp = window.setTimeout(() => setWaiting(null), 10_000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(giveUp);
      setShown(false);
    };
  }, [waiting]);

  // The new page is there: done (also coming back to the old address later must not show it again).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is the router's, it changed outside React state
    setWaiting(null);
  }, [here]);
  const pending = waiting !== null && waiting.at === here;
  return (
    <div aria-hidden="true" data-nav-pending={pending && shown ? "" : undefined} className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden">
      {pending && shown && <span className="animate-nav-pending block h-full w-1/3 rounded-full bg-green" />}
    </div>
  );
}
