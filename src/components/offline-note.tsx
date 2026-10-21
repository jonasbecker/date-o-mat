"use client";

import { useEffect, useState } from "react";

/** Whether the server answers: `navigator.onLine` can say "online" on a dead network (iOS, a cut connection). */
async function reachable(): Promise<boolean> {
  try {
    // Not a GET, so the service worker lets it through to the network.
    await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Without network the app shows the last state of its pages (the service worker keeps them) – this line says
 * so, so nobody takes it for live. Changes need the network again.
 */
export function OfflineNote() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ok = navigator.onLine && (await reachable());
      if (alive) setOffline(!ok);
    };
    const onOffline = () => setOffline(true);
    const onShow = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    window.addEventListener("online", check);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      window.removeEventListener("online", check);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  if (!offline) return null;
  return (
    <p role="status" data-offline className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-zitrone-soft pb-1 pt-[max(env(safe-area-inset-top),4px)] text-center text-[12px] font-bold text-tinte">
      offline – du siehst den letzten Stand
    </p>
  );
}
