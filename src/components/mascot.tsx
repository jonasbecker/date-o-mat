import { cn } from "@/lib/cn";
import { LogoMark } from "./logo";

/** The gumball machine from the logo – for empty states and while the Date-O-Mat "cranks". */
export function Mascot({ size = 64, busy = false, id, className }: { size?: number; busy?: boolean; id: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-block", busy && "animate-bob", className)}>
      <LogoMark size={size} clipId={`mascot-${id}`} />
    </span>
  );
}
