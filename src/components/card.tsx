import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Bright fills always use dark ink text so they stay readable in dark mode.
const TONE = {
  surface: "bg-surface text-ink",
  minze: "bg-minze text-tinte",
  mandarine: "bg-mandarine text-tinte",
  himmel: "bg-himmel text-tinte",
  zitrone: "bg-zitrone text-tinte",
  lavendel: "bg-lavendel text-tinte",
} as const;

const SIZE = {
  sm: "rounded-[22px] px-4 py-3.5",
  md: "rounded-[24px] p-5",
  lg: "rounded-[28px] p-6",
} as const;

export type CardTone = keyof typeof TONE;

export function Card({
  tone = "surface",
  size = "md",
  className,
  ...props
}: ComponentProps<"div"> & { tone?: CardTone; size?: keyof typeof SIZE }) {
  return <div className={cn("sticker", TONE[tone], SIZE[size], className)} {...props} />;
}

export function Chip({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-line px-2.5 py-0.5 text-[13px] font-extrabold",
        // Defaults only when the caller sets no colour – two bg-/text- classes would fight.
        !/\bbg-/.test(className ?? "") && "bg-surface",
        !/\btext-(ink|tinte|muted|bg)\b/.test(className ?? "") && "text-ink",
        className,
      )}
      {...props}
    />
  );
}
