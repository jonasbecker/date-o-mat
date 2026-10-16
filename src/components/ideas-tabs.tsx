import Link from "next/link";
import { cn } from "@/lib/cn";

/** Switch between the wishlist, swiping new ideas and what's on in town. */
export function IdeasTabs({ current }: { current: "entdecken" | "wishlist" | "events" }) {
  const tabs = [
    { key: "wishlist", href: "/ideas", label: "💡 Wunschliste" },
    { key: "entdecken", href: "/ideas/entdecken", label: "💞 Swipen" },
    { key: "events", href: "/events", label: "🎟️ Was läuft" },
  ] as const;
  return (
    <nav aria-label="Ideen" className="flex gap-1 overflow-x-auto rounded-full border-2 border-line bg-surface p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={cn(
            "shrink-0 grow rounded-full px-2.5 py-1.5 text-center text-[13px] font-extrabold whitespace-nowrap",
            current === tab.key ? "bg-ink text-bg" : "text-muted",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
