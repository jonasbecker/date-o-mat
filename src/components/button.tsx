import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Bright fills always get dark ink text; the neutral button follows the color scheme.
const VARIANT = {
  primary: "bg-himbeere text-tinte",
  success: "bg-minze text-tinte",
  secondary: "bg-surface text-ink",
} as const;

const SIZE = {
  lg: "h-16 rounded-[22px] px-6 text-[22px]",
  md: "h-[52px] rounded-[18px] px-5 text-lg",
  sm: "h-10 rounded-full px-4 text-[15px]",
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

/** Class names for anything that should look like a button (also links). */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    // Only buttons that do the thing get the sticker shadow; secondary ones stay flat.
    variant === "secondary" ? "flat tap" : "sticker press",
    "inline-flex items-center justify-center gap-2 font-display font-semibold",
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
