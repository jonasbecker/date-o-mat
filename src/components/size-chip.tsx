import { cn } from "@/lib/cn";
import type { IdeaSize } from "@/lib/domain";
import { ClockIcon, SunIcon } from "./icons";

// The emoji stay for choices (filter, plan toggle); chips in lists use the quiet icons.
export const SIZE_LABEL: Record<IdeaSize, { emoji: string; label: string; hint: string }> = {
  small: { emoji: "☕", label: "Kurz", hint: "ca. 2 Stunden" },
  large: { emoji: "🎡", label: "Lang", hint: "halber Tag und mehr" },
};

/** "Kurz" / "Lang" – neutral, so color is left for what needs attention. */
export function SizeChip({ size, className }: { size: IdeaSize; className?: string }) {
  const { label } = SIZE_LABEL[size];
  const Icon = size === "small" ? ClockIcon : SunIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border-[1.5px] border-line bg-bg px-2 py-px text-[12px] font-extrabold text-ink", className)}>
      <Icon width={13} height={13} strokeWidth={2.8} />
      {label}
    </span>
  );
}
