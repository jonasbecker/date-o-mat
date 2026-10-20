import { cn } from "@/lib/cn";
import { RATING_MAX } from "@/lib/domain";

const HEART = "M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.9 4 7.2 4c2 0 3.4 1.1 4.8 2.9C13.4 5.1 14.8 4 16.8 4c3.3 0 5.6 3.2 4.4 6.6C19.5 15.4 12 20 12 20z";

export function HeartShape({ filled, size = 20, className }: { filled: boolean; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d={HEART}
        fill={filled ? "var(--color-himbeere)" : "none"}
        stroke={filled ? "var(--color-himbeere)" : "currentColor"}
        strokeWidth={filled ? 1.6 : 2}
        strokeLinejoin="round"
        className={filled ? undefined : "text-muted/60"}
      />
    </svg>
  );
}

/** Read-only row of hearts, e.g. "4 von 5 Herzen". */
export function Hearts({ rating, size = 18, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span role="img" aria-label={`${rating} von ${RATING_MAX} Herzen`} className={cn("inline-flex gap-0.5", className)}>
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <HeartShape key={i} filled={i < rating} size={size} />
      ))}
    </span>
  );
}
