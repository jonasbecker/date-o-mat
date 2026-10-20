import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Pills (DESIGN.md §4): primary = ink, send = the planner's blue, secondary = outline only.
const VARIANT = {
  primary: "bg-ink text-bg",
  send: "bg-himmel text-white",
  success: "bg-ink text-bg",
  secondary: "border-[1.5px] border-ink bg-transparent text-ink",
} as const;

const SIZE = {
  lg: "h-[58px] rounded-full px-6 text-lg",
  md: "h-[52px] rounded-full px-5 text-[17px]",
  sm: "h-10 rounded-full px-4 text-[15px]",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/** Class names for anything that should look like a button (also links). */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "press inline-flex items-center justify-center gap-2 font-display font-bold",
    "disabled:cursor-not-allowed disabled:opacity-60",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}
