"use client";

import { useEffect } from "react";

/** Registers /sw.js once – needed for push notifications. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("[sw] registration failed", error));
    }
  }, []);
  return null;
}

export type PushSupport = "supported" | "ios-browser" | "unsupported";

/** iOS only allows push for apps added to the home screen. */
export function detectPushSupport(): PushSupport {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return "ios-browser";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "supported";
  return "unsupported";
}
