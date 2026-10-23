import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { BackIcon } from "@/components/icons";
import { buttonClass } from "@/components/button";
import { requireCouple } from "@/server/auth/dal";
import { env } from "@/server/env";
import { dayLabel } from "@/core/archive";
import { bannerView } from "@/core/banners";
import { visibleReviews } from "@/core/reviews";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { archiveData } from "@/server/archive";
import { dateForViewer, getDate } from "@/server/dates";
import { type ArchivePerson } from "../archive-parts";
import { LeafDetail } from "./leaf-detail";
import { DateCard } from "@/components/date-card";
import { coupleNow } from "@/server/clock";
import { getCoupleSettings } from "@/server/settings";
import { dateExtrasFor } from "../../overview";

export default function DatePage({ params }: PageProps<"/dates/[id]">) {
  return <DateDetail params={params} />;
}

async function DateDetail({ params }: { params: PageProps<"/dates/[id]">["params"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  const { id } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(id);
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  // The next date: everything that does not fit on the start page.
  const upcoming = valid ? await getDate(coupleId, id) : undefined;
  if (upcoming && (upcoming.status === "planned" || upcoming.status === "confirmed") && upcoming.endsAt > now) {
    const shown = dateForViewer(upcoming, user.id, [user, partner], now);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <AutoRefresh />
        {/* Like "euer blatt.": the round arrow on top, the card carries the title. */}
        <div className="flex items-center justify-between">
          <Link data-back href="/plan" aria-label="Zum Beet" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
            <BackIcon width={20} height={20} />
          </Link>
          <span className="meta">Details</span>
        </div>
        <h1 className="sr-only">Euer Date</h1>
        <DateCard date={shown} me={user} partner={partner} extras={await dateExtrasFor(ctx, settings, upcoming, now)} />
      </div>
    );
  }
  // An old link (a push, the calendar) to a date that was called off: say so instead of "Hier ist nichts".
  if (upcoming?.status === "cancelled") {
    const shown = dateForViewer(upcoming, user.id, [user, partner], now);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link data-back href="/plan" aria-label="Zum Beet" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
            <BackIcon width={20} height={20} />
          </Link>
          <span className="meta">Details</span>
        </div>
        <h1 className="headline text-[clamp(40px,12vw,54px)]">abgesagt.</h1>
        <p className="text-base text-muted" data-cancelled-date>
          <span className="font-semibold text-ink">{shown.title}</span> · {formatShortDate(shown.startsAt)}, {formatTimeRange(shown.startsAt, shown.endsAt)} – dieses Date wurde abgesagt.
        </p>
        <Link href="/plan" className={buttonClass("primary", "md", "mt-auto w-full")}>
          Zum Beet
        </Link>
      </div>
    );
  }
  // Over but nobody said yes: the Beet asks "habt ihr's gemacht?".
  if (upcoming?.status === "planned") redirect("/plan");
  // A date that happened: its leaf (ARCHIV.md §2).
  const archive = valid ? await archiveData(ctx, id) : undefined;
  const entry = archive?.dates.get(id);
  const leaf = archive?.leaves.find((l) => l.kind === "date" && l.id === id);
  if (!entry || !leaf) notFound();
  const people = new Map<string, ArchivePerson>([user, partner].map((p) => [p.id, { id: p.id, name: p.name, color: p.color }]));
  const { mine, partner: theirs, partnerHidden } = visibleReviews(entry.reviews, user.id);
  const cost = entry.costEur === null ? null : entry.costEur === 0 ? "gratis" : `${entry.costEur} €`;
  const meta = [dayLabel(entry.startsAt), formatTimeRange(entry.startsAt, entry.endsAt).replace(" – ", "–"), entry.location?.split(",")[0], cost].filter(Boolean).join(" · ");
  return (
    <>
      <AutoRefresh />
      <LeafDetail
        dateId={entry.id}
        nr={leaf.nr}
        title={entry.title}
        meta={meta}
        planner={people.get(entry.plannerId ?? "")}
        scene={bannerView(entry.motif)}
        photoIds={entry.photoIds}
        canUpload={env().photoStorage !== null}
        myAnswerMissing={!mine}
        answers={[
          { person: people.get(user.id)!, again: mine?.again ?? null, note: mine?.note ?? null, hidden: false },
          { person: people.get(partner.id)!, again: theirs?.again ?? null, note: theirs?.note ?? null, hidden: partnerHidden },
        ]}
      />
    </>
  );
}
