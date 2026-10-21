import { cn } from "@/lib/cn";
import { LogoMark } from "./logo";

/** The little plant from the logo – for empty states and while Zweisamen is busy. */
export function Mascot({ size = 64, busy = false, id, className }: { size?: number; busy?: boolean; id: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-block", busy && "animate-bob", className)}>
      <LogoMark size={size} clipId={`mascot-${id}`} />
    </span>
  );
}
