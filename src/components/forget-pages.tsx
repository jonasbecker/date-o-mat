"use client";

import { useEffect } from "react";
import { forgetSwipes } from "@/app/(app)/ideas/entdecken/swipe-queue";

/** The pages the service worker keeps for offline hold your data: signed out, they go (sw.js "dom-pages-v1") – and so do the swipes kept offline. */
export function ForgetPages() {
  useEffect(() => {
    if ("caches" in window) void caches.delete("dom-pages-v1").catch(() => {});
    forgetSwipes();
  }, []);
  return null;
}
