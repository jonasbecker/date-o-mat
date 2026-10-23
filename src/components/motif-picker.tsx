"use client";

// "Bild auf der Karte" in the idea editor (SWIPE-KARTE-V2.md §3): a row of small banners, scrolling sideways, "✨ Auto"
// first (Claude or the words pick). Its own chunk – the whole library comes along only when this row is shown.
import { BANNERS, MOTIFS, bannerView } from "@/core/banners";
import { Banner } from "./banner";

export function MotifPicker({ initial }: { initial: string }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-[13px] font-extrabold text-muted">Bild auf der Karte</legend>
      <div data-motif-row className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {["", ...MOTIFS].map((motif) => (
          <label
            key={motif}
            title={motif ? BANNERS[motif].name : "Automatisch"}
            className="flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[12px] p-1 text-[11px] font-bold has-checked:bg-ink has-checked:text-bg has-focus-visible:outline-3 has-focus-visible:outline-himbeere"
          >
            <input type="radio" name="motif" value={motif} defaultChecked={initial === motif} aria-label={motif ? BANNERS[motif].name : "Automatisch"} className="sr-only" />
            {motif ? (
              <Banner scene={bannerView(motif)} hoehe={28} breite={88} className="rounded-[8px]" />
            ) : (
              <span className="flex h-7 w-[88px] items-center justify-center rounded-[8px] bg-soft">✨ Auto</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
