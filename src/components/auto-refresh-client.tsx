"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { stampAction } from "@/app/stamp-action";

/**
 * Keeps server-rendered data fresh without websockets: asks for the couple's fingerprint when the page shows
 * (also when a tab comes back from the browser's copy), when the app comes back to the foreground and every
 * `intervalMs` while visible – and re-renders only if it differs from the one the page was rendered with
 * (`stamp`). A refresh drops the browser's copies of all visited pages, so tabs would show their loading
 * skeleton again. The fingerprint also changes every 5 minutes.
 */
export function AutoRefreshClient({ stamp, intervalMs }: { stamp: string | null; intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    let asked = false;
    const check = async () => {
      if (document.visibilityState !== "visible" || asked) return;
      asked = true;
      let now: string | null;
      try {
        now = await stampAction();
      } catch {
        now = null; // offline – next time
      }
      asked = false;
      if (alive && now !== null && now !== stamp) router.refresh();
    };
    void check();
    const timer = setInterval(check, intervalMs);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router, intervalMs, stamp]);

  return null;
}
