"use client";

// A real Google map of a place, right in the card (Google's embed, no key). It loads only once it is on screen –
// a closed date card or a compact swipe card never fetches it – and it does not take fingers: a drag over it
// still moves the card, a tap opens the place (or the route) in Google Maps.
import { useEffect, useRef, useState } from "react";
import { mapEmbedUrl } from "@/core/date-extras";
import { cn } from "@/lib/cn";

export function MapEmbed({ place, href, label, className }: { place: string; href: string; label: string; className?: string }) {
  const box = useRef<HTMLAnchorElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver !== "function") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- an old browser: just load it
      setShown(true);
      return;
    }
    // Clipped away (the closed date card hides its details) counts as not shown.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  return (
    <a ref={box} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} data-map-embed={shown ? "loaded" : "waiting"} className={cn("relative block overflow-hidden rounded-[18px] bg-soft", className)}>
      {shown && (
        <iframe
          src={mapEmbedUrl(place)}
          title={`Karte: ${place}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full border-0"
        />
      )}
      <span className="meta pointer-events-none absolute bottom-2 left-2 rounded-full bg-[rgba(17,26,20,0.82)] px-2.5 py-1 text-[10px] text-ink">📍 {place} · in Maps öffnen ›</span>
    </a>
  );
}
