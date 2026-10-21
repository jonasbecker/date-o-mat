"use client";

import { useEffect } from "react";
import { queuedSwipes, sendQueuedSwipes } from "./swipe-queue";

/** Sends the swipes kept offline: when the app starts, comes to the front, gets network – and every 30 s while some wait. */
export function SwipeQueueFlusher() {
  useEffect(() => {
    const flush = () => {
      if (queuedSwipes().length > 0) void sendQueuedSwipes();
    };
    const onShow = () => document.visibilityState === "visible" && flush();
    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onShow);
    const timer = window.setInterval(flush, 30_000);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onShow);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}
