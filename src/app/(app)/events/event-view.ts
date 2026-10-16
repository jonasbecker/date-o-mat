import { parsePriceEur } from "@/core/budget";
import { eventSpan } from "@/core/events";
import { dayHeading, formatClock, formatShortDate } from "@/lib/format";
import type { EventWithSource } from "@/server/events";
import type { EventView } from "./event-list";

/** What an event card needs, formatted on the server. */
export function eventView(e: EventWithSource, extra: { free: boolean | null; saved: boolean; now: Date }): EventView {
  const span = eventSpan(e);
  return {
    id: e.id,
    title: e.title,
    time: !e.startsAt ? "" : e.allDay ? (e.endsAt ? `bis ${formatShortDate(e.endsAt)}` : "ganztägig") : formatClock(e.startsAt),
    venue: e.venue,
    price: e.priceText,
    costEur: parsePriceEur(e.priceText),
    summary: e.summary,
    url: e.url,
    source: e.sourceLabel,
    free: extra.free,
    plannable: span !== null,
    saved: extra.saved,
    when: span ? `${dayHeading(span.start, extra.now)}, ${formatClock(span.start)}` : "",
  };
}
