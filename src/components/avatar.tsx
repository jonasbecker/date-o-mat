import { cn } from "@/lib/cn";
import type { UserColor } from "@/lib/domain";

// White circle with the initial; the person color is the ring (DESIGN.md §4).
const RING_CLASS: Record<UserColor, string> = {
  mandarine: "ring-mandarine",
  himmel: "ring-himmel",
};

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export type AvatarPerson = { name: string; color: UserColor | null };

export function Avatar({
  person,
  size = 36,
  className,
}: {
  person: AvatarPerson;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={person.name}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-white font-display font-bold text-tinte ring-2",
        RING_CLASS[person.color ?? "mandarine"],
        className,
      )}
    >
      {initial(person.name)}
    </span>
  );
}

export function AvatarPair({ a, b, size = 36 }: { a: AvatarPerson; b: AvatarPerson; size?: number }) {
  return (
    <span className="inline-flex items-center">
      <Avatar person={a} size={size} />
      <Avatar person={b} size={size} className="-ml-1.5" />
    </span>
  );
}
