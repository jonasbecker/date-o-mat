"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AlertIcon, BellIcon, BulbIcon, CalendarIcon, CheckIcon, ClockIcon, CompassIcon, GiftIcon, HeartIcon, CardsIcon, RepeatIcon, SlidersIcon, SparkleIcon, SunIcon, TicketIcon, UserIcon, WalletIcon } from "@/components/icons";

// Settings as screens: a menu of topics, each topic its own screen (/settings?t=budget).

const ICONS = {
  status: CheckIcon,
  warn: AlertIcon,
  repeat: RepeatIcon,
  clock: ClockIcon,
  ticket: TicketIcon,
  heart: HeartIcon,
  wallet: WalletIcon,
  gift: GiftIcon,
  sparkle: SparkleIcon,
  calendar: CalendarIcon,
  bell: BellIcon,
  compass: CompassIcon,
  user: UserIcon,
  intro: BulbIcon,
  theme: SunIcon,
  story: SparkleIcon,
  cards: CardsIcon,
  sliders: SlidersIcon,
} as const;

export type TopicTile = { id: string; icon: keyof typeof ICONS; title: string; hint?: string; href?: string };

/** One settings topic. */
export function Topic({ id, title, children }: { id: string; title?: string; hint?: string; children: ReactNode }) {
  // The title and the hint stand at the top of the page (`PageTitle` in settings/page.tsx reads them from here).
  return (
    <section id={id} aria-label={title} className="flex flex-col gap-3">
      {children}
    </section>
  );
}

/** "Mehr": everything that is not on the main setup page, as one calm list of rows. */
export function MoreList({ groups, status }: { groups: Array<{ title: string; tiles: TopicTile[] }>; status: { ok: boolean; tile: TopicTile } }) {
  return (
    <nav aria-label="Themen" className="flex flex-col gap-3">
      <HashToTopic />
      {!status.ok && <Tile tile={status.tile} warn />}
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="flex flex-col gap-1.5">
          <h2 className="text-[13px] text-muted">{group.title}</h2>
          <div className="flex flex-col overflow-hidden rounded-[22px] bg-surface">
            {group.tiles.map((tile, i) => {
              const Icon = ICONS[tile.icon];
              return (
                <Link key={tile.id} href={tile.href ?? `/settings?t=${tile.id}`} className={`tap flex min-h-12 items-center gap-3 px-4 py-2 ${i > 0 ? "border-t border-soft" : ""}`}>
                  <Icon width={18} height={18} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight">{tile.title}</span>
                    {tile.hint && <span className="block truncate text-xs text-muted">{tile.hint}</span>}
                  </span>
                  <span aria-hidden="true" className="text-muted">›</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      {status.ok && (
        <Link href={`/settings?t=${status.tile.id}`} className="flex items-center justify-center gap-1 text-sm font-semibold underline">
          <CheckIcon width={15} height={15} /> Alles läuft
        </Link>
      )}
    </nav>
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
      <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold">
        {status.ok && (
          <Link href={`/settings?t=${status.tile.id}`} className="flex items-center gap-1 underline">
            <CheckIcon width={15} height={15} /> Alles läuft
          </Link>
        )}
        {extra.map((tile) => {
          const Icon = ICONS[tile.icon];
          return (
            <Link key={tile.id} href={tile.href ?? `/settings?t=${tile.id}`} className="flex items-center gap-1 underline">
              <Icon width={15} height={15} /> {tile.title}
            </Link>
          );
        })}
      </p>
    </nav>
  );
}

function TileGroup({ title, tiles }: { title: string; tiles: TopicTile[] }) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h2 className="text-[13px] text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <Tile key={tile.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}

function Tile({ tile, warn = false }: { tile: TopicTile; warn?: boolean }) {
  const Icon = ICONS[tile.icon];
  return (
    <Link
      href={tile.href ?? `/settings?t=${tile.id}`}
      className={`tap flex min-h-[58px] flex-col justify-center rounded-[20px] px-3.5 py-2 ${warn ? "bg-zitrone-soft text-tinte" : "bg-surface"}`}
    >
      <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-tight">
        <Icon width={17} height={17} className="shrink-0" /> {tile.title}
      </span>
      {tile.hint && <span className={`truncate pl-[23px] text-xs ${warn ? "" : "text-muted"}`}>{tile.hint}</span>}
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
