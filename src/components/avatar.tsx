import { cn } from "@/lib/cn";
import type { UserColor } from "@/lib/domain";

const COLOR_CLASS: Record<UserColor, string> = {
  mandarine: "bg-mandarine",
  himmel: "bg-himmel",
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
        "inline-flex shrink-0 items-center justify-center rounded-full border-[2.5px] border-line font-display font-semibold text-tinte",
        COLOR_CLASS[person.color ?? "mandarine"],
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
      <Avatar person={b} size={size} className="-ml-2.5" />
    </span>
  );
}
