import type { Metadata } from "next";
import { Banner } from "@/components/banner";
import { BANNERS, MOTIFS, bannerView } from "@/core/banners";

export const metadata: Metadata = { title: "Banner – alle 76 Motive" };

// The banner library (docs/design/garten/swipe-karte-v2/BannerGalerie.html): every scene at the card's size and as the
// small tile, to compare with the reference.
export default function BannerPage() {
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-5 p-6">
      {MOTIFS.map((motif) => (
        <figure key={motif} data-dev-banner={motif} className="flex flex-col gap-2">
          <Banner scene={bannerView(motif)} hoehe={170} breite={350} className="rounded-[20px]" />
          <figcaption className="flex items-center gap-3 text-sm">
            <Banner scene={bannerView(motif)} hoehe={56} breite={56} className="rounded-[15px]" />
            <span className="font-bold">{BANNERS[motif].name}</span>
            <code className="font-mono text-muted">{motif}</code>
          </figcaption>
        </figure>
      ))}
    </main>
  );
}
