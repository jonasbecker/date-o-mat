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

/** The menu: what you set for both, what only for yourself; "Läuft alles?" only stands out when something is wrong. */
export function TopicMenu({ shared, personal, status, extra }: { shared: TopicTile[]; personal: TopicTile[]; status: { ok: boolean; tile: TopicTile }; extra: TopicTile[] }) {
  return (
    <nav aria-label="Themen" className="flex flex-col gap-3">
      <HashToTopic />
      {!status.ok && <Tile tile={status.tile} warn />}
      <TileGroup title="Für euch beide" tiles={shared} />
      <TileGroup title="Nur für dich" tiles={personal} />
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-extrabold">
        {status.ok && (
          <Link href={`/settings?t=${status.tile.id}`} className="underline">
            ✅ Alles läuft
          </Link>
        )}
        {extra.map((tile) => (
          <Link key={tile.id} href={tile.href ?? `/settings?t=${tile.id}`} className="underline">
            {tile.emoji} {tile.title}
          </Link>
        ))}
      </p>
    </nav>
  );
}

function TileGroup({ title, tiles }: { title: string; tiles: TopicTile[] }) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}

function Tile({ tile, warn = false }: { tile: TopicTile; warn?: boolean }) {
  return (
    <Link
      href={tile.href ?? `/settings?t=${tile.id}`}
      className={`press flex min-h-[58px] flex-col justify-center rounded-[18px] border-2 border-line px-3 py-2 ${warn ? "bg-zitrone-soft text-tinte" : "bg-surface"}`}
    >
      <span className="font-display text-[15px] font-semibold leading-tight">
        {tile.emoji} {tile.title}
      </span>
      {tile.hint && <span className={`truncate text-xs font-bold ${warn ? "" : "text-muted"}`}>{tile.hint}</span>}
    </Link>
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
