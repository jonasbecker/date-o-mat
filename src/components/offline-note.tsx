"use client";

import { useSyncExternalStore } from "react";

function subscribe(changed: () => void) {
  window.addEventListener("online", changed);
  window.addEventListener("offline", changed);
  return () => {
    window.removeEventListener("online", changed);
    window.removeEventListener("offline", changed);
  };
}

/**
 * Without network the app shows the last state of its pages (the service worker keeps them) – this line says
 * so, so nobody takes it for live. Changes need the network again.
 */
export function OfflineNote() {
  const offline = useSyncExternalStore(subscribe, () => !navigator.onLine, () => false);
  if (!offline) return null;
  return (
    <p role="status" data-offline className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-zitrone-soft pb-1 pt-[max(env(safe-area-inset-top),4px)] text-center text-[12px] font-bold text-tinte">
      offline – du siehst den letzten Stand
    </p>
  );
}
