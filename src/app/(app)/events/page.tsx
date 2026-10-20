import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { agoLabel, dayHeading } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { freeForEvents, listSources, savedRefs, tipsList, upcomingEvents } from "@/server/events";
import { getCoupleSettings } from "@/server/settings";
import { EventList, type EventGroup } from "./event-list";
import { eventView } from "./event-view";

// "Als Date planen" checks both calendars and creates the Google event.
export const maxDuration = 60;

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <div className="flex flex-col gap-4">
      <AppHeader />
      <h1 className="headline lowercase text-[clamp(34px,10vw,46px)] after:content-['.']">Was läuft</h1>
      <Suspense fallback={<PageSkeleton />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Events({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const [sources, upcoming, tips, saved, params] = await Promise.all([
    listSources(ctx.coupleId),
    upcomingEvents(ctx.coupleId, now),
    tipsList(ctx.coupleId),
    savedRefs(ctx.coupleId),
    searchParams,
  ]);

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-10 text-center">
        <span className="text-5xl" aria-hidden="true">
          🎟️
        </span>
        <p className="font-display text-xl font-semibold">Folgt euren Lieblings-Seiten</p>
        <p className="font-semibold text-muted">
          Der Date-O-Mat liest jeden Morgen eure Veranstaltungsseiten und zeigt hier, was läuft – und wann ihr beide Zeit habt.
        </p>
        <Link href="/settings?t=events" className="font-extrabold underline">
          Event-Quellen einrichten
        </Link>
      </div>
    );
  }

  const free = await freeForEvents(ctx, upcoming);

  const toView = (e: (typeof upcoming)[number]) => eventView(e, { free: free?.get(e.id) ?? null, saved: saved.has(e.dedupeKey), now });

  const groups: EventGroup[] = [];
  const running = upcoming.filter((e) => e.allDay && e.startsAt! < now);
  if (running.length) groups.push({ heading: "Läuft gerade", events: running.map(toView) });
  for (const e of upcoming.filter((x) => !running.includes(x))) {
    const heading = dayHeading(e.startsAt!, now);
    const group = groups.at(-1)?.heading === heading ? groups.at(-1)! : (groups.push({ heading, events: [] }), groups.at(-1)!);
    group.events.push(toView(e));
  }

  const lastFetch = sources.map((s) => s.lastFetchedAt).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <>
      <AutoRefresh />
      <EventList
        groups={groups}
        tips={tips.map((t) => eventView(t, { free: null, saved: saved.has(t.dedupeKey), now }))}
        calendarsReadable={free !== null}
        initialFilter={params.free === "1" ? "free" : "all"}
      />
      <p className="text-center text-[13px] font-bold text-muted">
        {lastFetch ? `Zuletzt aktualisiert ${agoLabel(now, lastFetch)} · ` : ""}
        <Link href="/settings?t=events" className="underline">
          Quellen verwalten
        </Link>
      </p>
    </>
  );
}
