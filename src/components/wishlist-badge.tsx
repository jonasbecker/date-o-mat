"use client";

import { useEffect, useState } from "react";

/** The swipe deck announces a new wishlist idea with this event – the badge counts up at once. */
export const WISHLIST_ADDED_EVENT = "dom-wishlist-added";

/**
 * The number of ideas on the wishlist, on the 💡 icon. The server count is the truth; between two
 * refreshes the badge adds what was just liked here, and pops.
 */
export function WishlistBadge({ count }: { count: number }) {
  const [bonus, setBonus] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the server count caught up: start from it
    setBonus(0);
  }, [count]);
  useEffect(() => {
    const onAdded = () => setBonus((n) => n + 1);
    window.addEventListener(WISHLIST_ADDED_EVENT, onAdded);
    return () => window.removeEventListener(WISHLIST_ADDED_EVENT, onAdded);
  }, []);
  const shown = count + bonus;
  if (shown <= 0) return null;
  return (
    <span
      key={shown}
      aria-hidden="true"
      className="animate-pop-in pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-line bg-himbeere px-1 text-[11px] font-extrabold leading-none text-tinte"
    >
      {shown}
    </span>
  );
}
