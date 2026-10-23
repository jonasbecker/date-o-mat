"use client";

// "wie war's?" opens by itself the first time the app is opened after a date (ARCHIV.md §3) – once per date and phone
// (localStorage), and only when the Beet comes up with the app (the hint was in the page as it loaded): answering
// "habt ihr's gemacht?" on the Beet does not throw you out of it. After that the hint stays until it is filled in.
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};

export function OpenReviewOnce({ dateId }: { dateId: string }) {
  const router = useRouter();
  // True only while the page hydrates (the server's snapshot) – a hint that shows up later reads false.
  const hydrating = useSyncExternalStore(noop, () => false, () => true);
  const [withTheApp] = useState(hydrating);
  useEffect(() => {
    if (!withTheApp) return;
    const key = `dom-wie-wars-${dateId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      return;
    }
    router.push(`/dates/${dateId}/wie-wars`);
  }, [dateId, router, withTheApp]);
  return null;
}
