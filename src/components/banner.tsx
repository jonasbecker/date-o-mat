"use client";

// A scene from the banner library (core/banners.ts) filling a box: the 350 × 110 stage is scaled until it covers
// width and height, anchored bottom center – the sides are cut on a narrow box, the top is always sky (its pastel).
// Without a size it measures its box (`fill`). Decorative: aria-hidden, the title next to it is the information.
// It takes the scene itself (`bannerView()` on the server), so the library of 76 never has to go to the phone.

import { memo, useLayoutEffect, useRef, useState } from "react";
import { bannerScale, STAGE, type SceneView } from "@/core/banner-scene";
import { cn } from "@/lib/cn";

type Props = {
  scene: SceneView;
  /** Size of the box in px; leave both out to fill the parent (`className` gives it a size). */
  hoehe?: number;
  breite?: number;
  className?: string;
};

export const Banner = memo(function Banner({ scene, hoehe, breite, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const fixed = hoehe !== undefined && breite !== undefined;
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (fixed || !el) return;
    const read = () => setMeasured((m) => (m && m.w === el.clientWidth && m.h === el.clientHeight ? m : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixed]);
  const w = fixed ? breite : measured?.w;
  const h = fixed ? hoehe : measured?.h;
  return (
    <div
      ref={box}
      aria-hidden="true"
      data-banner={scene.key}
      className={cn(!className?.includes("absolute") && "relative", "overflow-hidden", className)}
      style={{ background: scene.bg, ...(fixed ? { width: breite, height: hoehe } : {}) }}
    >
      {w !== undefined && h !== undefined && w > 0 && h > 0 && (
        <div
          className="absolute bottom-0 left-1/2"
          style={{ width: STAGE.width, height: STAGE.height, marginLeft: -STAGE.width / 2, transform: `scale(${bannerScale(w, h)})`, transformOrigin: "50% 100%" }}
        >
          {scene.shapes.map((s, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                left: s.l,
                top: s.t,
                width: s.w,
                height: s.h,
                borderRadius: s.r,
                background: s.c,
                transform: s.rot ? `rotate(${s.rot}deg)` : undefined,
                opacity: s.op,
                clipPath: s.clip === "none" ? undefined : s.clip,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
