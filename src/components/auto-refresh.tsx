"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps server-rendered data fresh without websockets: re-renders the page
 * when the app comes back to the foreground and every `intervalMs` while visible.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  return null;
}
