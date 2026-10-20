import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Bright fills always use dark ink text so they stay readable in dark mode.
// Pastel fills (DESIGN.md §2); person tones are only a soft tint – the person color itself is an accent.
const TONE = {
  surface: "bg-surface text-ink",
  minze: "bg-minze-soft text-tinte",
  mandarine: "bg-rose text-tinte",
  himmel: "bg-tile-sky text-tinte",
  zitrone: "bg-zitrone-soft text-tinte",
  lavendel: "bg-tile-lilac text-tinte",
} as const;

const SIZE = {
  sm: "rounded-[20px] px-4 py-3.5",
  md: "rounded-[22px] p-4",
  lg: "rounded-[24px] p-5",
} as const;

export type CardTone = keyof typeof TONE;

export function Card({
  tone = "surface",
  size = "md",
  flat = false,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: CardTone; size?: keyof typeof SIZE; /** Outline only – for what you read, not what you tap. */ flat?: boolean }) {
  return <div className={cn(flat ? "flat" : "sticker", TONE[tone], SIZE[size], className)} {...props} />;
}

export function Chip({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px]",
        // Defaults only when the caller sets no colour – two bg-/text- classes would fight.
        !/\bbg-/.test(className ?? "") && "bg-soft",
        !/\btext-(ink|tinte|muted|bg)\b/.test(className ?? "") && "text-ink",
        className,
      )}
      {...props}
    />
  );
}
