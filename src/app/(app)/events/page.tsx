import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { IdeasTabs } from "@/components/ideas-tabs";
import { eventSpan } from "@/core/events";
import { agoLabel, dayHeading, formatClock, formatShortDate } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { freeForEvents, listSources, savedRefs, tipsList, upcomingEvents } from "@/server/events";
import { getCoupleSettings } from "@/server/settings";
import { EventList, type EventGroup, type EventView } from "./event-list";

// "Als Date planen" checks both calendars and creates the Google event.
export const maxDuration = 60;

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px] font-bold">Was läuft</h1>
      <IdeasTabs current="events" />
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
        <Link href="/settings#events" className="font-extrabold underline">
          Event-Quellen einrichten
        </Link>
      </div>
    );
  }

  const free = await freeForEvents(ctx, upcoming);

  const toView = (e: (typeof upcoming)[number]): EventView => {
    const span = eventSpan(e);
    return {
      id: e.id,
      title: e.title,
      time: e.allDay || !e.startsAt ? (e.endsAt ? `bis ${formatShortDate(e.endsAt)}` : "ganztägig") : formatClock(e.startsAt),
      venue: e.venue,
      price: e.priceText,
      summary: e.summary,
      url: e.url,
      source: e.sourceLabel,
      free: free?.get(e.id) ?? null,
      plannable: span !== null,
      saved: saved.has(e.dedupeKey),
      when: span ? `${dayHeading(span.start, now)}, ${formatClock(span.start)}` : "",
    };
  };

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
        tips={tips.map((t) => ({
          id: t.id,
          title: t.title,
          time: "",
          venue: t.venue,
          price: t.priceText,
          summary: t.summary,
          url: t.url,
          source: t.sourceLabel,
          free: null,
          plannable: false,
          saved: saved.has(t.dedupeKey),
          when: "",
        }))}
        calendarsReadable={free !== null}
        initialFilter={params.free === "1" ? "free" : "all"}
      />
      <p className="text-center text-[13px] font-bold text-muted">
        {lastFetch ? `Zuletzt aktualisiert ${agoLabel(now, lastFetch)} · ` : ""}
        <Link href="/settings#events" className="underline">
          Quellen verwalten
        </Link>
      </p>
    </>
  );
}
