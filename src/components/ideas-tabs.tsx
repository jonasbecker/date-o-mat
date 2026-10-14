import Link from "next/link";
import { cn } from "@/lib/cn";

/** Switch between the wishlist and what's on in town. */
export function IdeasTabs({ current }: { current: "wishlist" | "events" }) {
  const tabs = [
    { key: "wishlist", href: "/ideas", label: "💡 Wunschliste" },
    { key: "events", href: "/events", label: "🎟️ Was läuft" },
  ] as const;
  return (
    <nav aria-label="Ideen" className="grid grid-cols-2 gap-1 rounded-full border-2 border-line bg-surface p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={cn(
            "rounded-full py-1.5 text-center text-sm font-extrabold",
            current === tab.key ? "bg-ink text-bg" : "text-muted",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
