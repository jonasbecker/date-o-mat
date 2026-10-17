"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

// Settings as screens: a menu of topics, each topic its own screen (/settings?t=budget).

export type TopicTile = { id: string; emoji: string; title: string; hint?: string; href?: string };

/** One settings topic. */
export function Topic({ id, title, hint, children }: { id: string; title?: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="flex flex-col gap-3">
      {title && <h2 className="text-[22px] font-semibold leading-tight">{title}</h2>}
      {hint && <p className="-mt-2 text-sm font-semibold text-muted">{hint}</p>}
      {children}
    </section>
  );
}

/** The menu of topics. */
export function TopicMenu({ tiles }: { tiles: TopicTile[] }) {
  return (
    <nav aria-label="Themen" className="grid grid-cols-2 gap-2">
      <HashToTopic />
      {tiles.map((tile) => (
        <Link key={tile.id} href={tile.href ?? `/settings?t=${tile.id}`} className="press flex min-h-[64px] flex-col justify-center rounded-[18px] border-2 border-line bg-surface px-3 py-2">
          <span className="font-display text-[15px] font-semibold leading-tight">
            {tile.emoji} {tile.title}
          </span>
          {tile.hint && <span className="truncate text-xs font-bold text-muted">{tile.hint}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** Older links (/settings?t=budget, also in sent pushes) open the topic. */
function HashToTopic() {
  const router = useRouter();
  useEffect(() => {
    const topic = decodeURIComponent(window.location.hash.slice(1)).replace(/[^a-z-]/g, "");
    if (topic) router.replace(`/settings?t=${topic}`);
  }, [router]);
  return null;
}
