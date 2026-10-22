"use client";

import { useEffect } from "react";
import { queuedSwipes, sendQueuedSwipes } from "./swipe-queue";

/** After a failed try (the network is not really back yet) the next one comes quickly, then less often. */
const RETRY_MS = [2_000, 5_000, 15_000, 30_000];

/** Sends the swipes kept offline: when the app starts, comes to the front, gets network – and again until they are gone. */
export function SwipeQueueFlusher() {
  useEffect(() => {
    let timer: number | undefined;
    let tries = 0;
    let alive = true;
    const flush = async () => {
      window.clearTimeout(timer);
      if (queuedSwipes().length === 0) {
        tries = 0;
        return;
      }
      await sendQueuedSwipes();
      if (!alive) return;
      if (queuedSwipes().length === 0) {
        tries = 0;
        return;
      }
      timer = window.setTimeout(flush, RETRY_MS[Math.min(tries++, RETRY_MS.length - 1)]);
    };
    const fresh = () => {
      tries = 0;
      void flush();
    };
    const onShow = () => document.visibilityState === "visible" && fresh();
    fresh();
    window.addEventListener("online", fresh);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener("online", fresh);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  return null;
}
