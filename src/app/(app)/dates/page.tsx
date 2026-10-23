import { cookies } from "next/headers";
import { connection } from "next/server";
import { DateTime } from "luxon";
import { AppHeader, HeaderMeta } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { Mascot } from "@/components/mascot";
import { ARCHIVE_VIEW_COOKIE, dayLabel, type ArchiveView } from "@/core/archive";
import { APP_TIMEZONE } from "@/lib/domain";
import { archiveData } from "@/server/archive";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { getCoupleSettings } from "@/server/settings";
import { Grid, Stem, type ArchivePerson } from "./archive-parts";
import { ArchiveViews } from "./archive-views";

/**
 * "unser beet." (docs/design/garten/archiv/ARCHIV.md §1): every date a leaf, every round that fell through a wilted
 * one, the next date a bud on top – as the stem or as a grid by month; the last view chosen comes back.
 */
export default function DatesPage({ searchParams }: PageProps<"/dates">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Dates searchParams={searchParams} />
    </div>
  );
}

async function Dates({ searchParams }: { searchParams: PageProps<"/dates">["searchParams"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const [archive, upcoming, { ansicht }, jar] = await Promise.all([archiveData(ctx), upcomingDate(coupleId, now), searchParams, cookies()]);
  const asked = ansicht === "raster" || ansicht === "stiel" ? ansicht : jar.get(ARCHIVE_VIEW_COOKIE)?.value;
  const view: ArchiveView = asked === "raster" ? "raster" : "stiel";
  const { leaves } = archive;
  const next = upcoming && dateForViewer(upcoming, user.id, [user, partner], now);
  const first = leaves.at(-1);
  const since = first && DateTime.fromJSDate(first.at, { zone: APP_TIMEZONE }).setLocale("de").toFormat("LLLL");
  const people = new Map<string, ArchivePerson>([user, partner].map((p) => [p.id, { id: p.id, name: p.name, color: p.color }]));
  const both = leaves.filter((l) => l.both).length;
  // The bud: the next planned date, as the next Nº.
  const bud = next ? `Nº${leaves.length + 1} · ${dayLabel(next.startsAt)} – wächst noch` : null;

  return (
    <>
      <AutoRefresh />
      <AppHeader action={<HeaderMeta>{leaves.length === 1 ? "1 Blatt" : `${leaves.length} Blätter`}{since ? ` · seit ${since}` : ""}</HeaderMeta>} />
      <h1 className="headline text-[54px] tracking-[-0.05em]">unser beet.</h1>
      {leaves.length === 0 && !next ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border-[1.5px] border-dashed border-line px-6 py-8 text-center">
          <Mascot id="no-dates" size={64} />
          <p className="text-xl font-bold">Hier wächst euer Beet</p>
          <p className="text-muted">Jedes Date wird hier ein Blatt – mit Foto, wenn ihr eins festhaltet.</p>
        </div>
      ) : (
        <ArchiveViews
          initial={view}
          again={<span className="font-mono text-[11px] text-butter">♥ {both}× nochmal</span>}
          stem={<Stem leaves={leaves} people={people} bud={bud} />}
          grid={<Grid leaves={leaves} people={people} />}
        />
      )}
    </>
  );
}
