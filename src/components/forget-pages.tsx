"use client";

import { useEffect } from "react";

/** The pages the service worker keeps for offline hold your data: signed out, they go (sw.js "dom-pages-v1"). */
export function ForgetPages() {
  useEffect(() => {
    if ("caches" in window) void caches.delete("dom-pages-v1").catch(() => {});
  }, []);
  return null;
}
