import { cn } from "@/lib/cn";
import type { IdeaSize } from "@/lib/domain";

export const SIZE_LABEL: Record<IdeaSize, { emoji: string; label: string; hint: string }> = {
  small: { emoji: "☕", label: "Klein", hint: "1–2 Stunden" },
  large: { emoji: "🎡", label: "Groß", hint: "halber Tag und mehr" },
};

export function SizeChip({ size, className }: { size: IdeaSize; className?: string }) {
  const { emoji, label } = SIZE_LABEL[size];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-[1.5px] border-line px-2 py-px text-[12px] font-extrabold text-tinte",
        size === "small" ? "bg-zitrone" : "bg-lavendel",
        className,
      )}
    >
      <span aria-hidden="true">{emoji}</span>
      {label}
    </span>
  );
}
