import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { Hearts } from "@/components/hearts";
import { BackIcon, CloseIcon } from "@/components/icons";
import { buttonClass } from "@/components/button";
import { AGAIN_LABEL } from "@/lib/domain";
import { visibleReviews, type ReviewView } from "@/core/reviews";
import { formatShortDate, formatTimeRange, genitive } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import type { User } from "@/server/db/schema";
import { pastDate } from "@/server/reviews";
import { ReviewForm } from "../review-form";
import { NextTimeIdeas } from "../next-time-ideas";
import type { IdeaCardView } from "@/components/idea-card";
import { listIdeas } from "@/server/ideas";
import { PhotoSection } from "../photo-section";
import { listPhotos } from "@/server/photos";
import { env } from "@/server/env";
import { DateCard } from "@/components/date-card";
import { Tabs } from "@/components/tabs";
import { coupleNow } from "@/server/clock";
import { countDoneDatesUntil, dateForViewer, getDate } from "@/server/dates";
import { getCoupleSettings } from "@/server/settings";
import { dateExtrasFor } from "../../overview";

export default function DatePage({ params, searchParams }: PageProps<"/dates/[id]">) {
  return <DateDetail params={params} searchParams={searchParams} />;
}

async function DateDetail({ params, searchParams }: { params: PageProps<"/dates/[id]">["params"]; searchParams: PageProps<"/dates/[id]">["searchParams"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  const { id } = await params;
  const { herzen } = await searchParams;
  // A tap on a heart on the start page: that many hearts are chosen already.
  const initialHearts = typeof herzen === "string" && /^[1-5]$/.test(herzen) ? Number(herzen) : 0;
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
          <Link href="/plan" aria-label="Zum Beet" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
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
          <Link href="/plan" aria-label="Zum Beet" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
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
  const date = valid ? await pastDate(coupleId, id) : undefined;
  if (!date) notFound();
  const { mine, partner: theirs, partnerHidden } = visibleReviews(date.reviews, user.id);
  // Nº of the leaf: the how-manyth date this was.
  const leafNo = (await countDoneDatesUntil(coupleId, date.startsAt)) || null;
  const photos = await listPhotos(coupleId, date.id);
  // Reviewed: what's next? The three ideas that have waited longest (not this one).
  const nextTime: IdeaCardView[] = mine
    ? (await listIdeas(coupleId))
        .filter((idea) => idea.id !== date.ideaId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, 3)
        .map((idea) => ({ id: idea.id, title: idea.title, size: idea.size, costEur: idea.costEur, location: idea.location }))
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AutoRefresh />
      <div className="flex items-center justify-between">
        <Link href="/dates" aria-label="Schließen" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
          <CloseIcon width={20} height={20} />
        </Link>
        <span className="font-mono text-[11px]">
          {leafNo ? `Nº${leafNo} · ` : ""}
          {formatShortDate(date.startsAt)}
        </span>
      </div>
      <div>
        <h1 className="headline text-[clamp(40px,12vw,54px)]">{mine ? "euer blatt." : "wie war’s?"}</h1>
        <p className="mt-2 text-base text-muted">
          <span className="font-semibold text-ink">{date.title}</span> · {formatTimeRange(date.startsAt, date.endsAt)}
          {date.location ? ` · ${date.location}` : ""}
        </p>
      </div>

      {/* One part at a time instead of a long page. */}
      <Tabs
        label="Zum Date"
        tabs={[
          {
            key: "mine",
            label: mine ? "💗 Herzen" : "💗 Bewerten",
            content: (
              <>
              <section aria-labelledby="review-heading" className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
                <h2 id="review-heading" className="text-lg font-bold">
                  {mine ? "Deine Herzen" : "Wie war's für dich?"}
                </h2>
                {mine && <ReviewBlock person={user} review={mine} />}
                {!mine && partnerHidden && (
                  <p className="text-sm text-muted">🔒 {partner.name} hat schon bewertet – nach deinen Herzen siehst du {genitive(partner.name)}.</p>
                )}
                <ReviewForm
                  key={mine?.rating ?? initialHearts}
                  initialHearts={initialHearts}
                  dateId={date.id}
                  rating={mine?.rating ?? null}
                  note={mine?.note ?? null}
                  again={mine?.again ?? null}
                  cost={date.actualCostEur ?? date.estimatedCostEur}
                />
              </section>
              <NextTimeIdeas ideas={nextTime} />
              </>
            ),
          },
          {
            key: "photos",
            label: photos.length ? `📸 Fotos (${photos.length})` : "📸 Fotos",
            content: <PhotoSection dateId={date.id} photos={photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))} enabled={env().photoStorage !== null} />,
          },
          {
            key: "partner",
            label: `${genitive(partner.name)} Herzen`,
            content: (
              <section aria-labelledby="partner-heading" className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
                <h2 id="partner-heading" className="text-lg font-bold">
                  So war&apos;s für {partner.name}
                </h2>
                {theirs ? (
                  <ReviewBlock person={partner} review={theirs} />
                ) : partnerHidden ? (
                  <p className="flex flex-wrap items-center gap-2 text-muted">
                    🔒 Verdeckt, bis du selbst bewertet hast – dann siehst du {genitive(partner.name)} Herzen.
                  </p>
                ) : (
                  <p className="text-muted">{partner.name} hat noch nicht bewertet.</p>
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}

function ReviewBlock({ person, review }: { person: User; review: ReviewView }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <Avatar person={person} size={30} />
        <Hearts rating={review.rating} size={24} />
      </div>
      {review.again && <p className="text-sm text-muted">Nochmal machen? <b className="font-semibold text-ink">{AGAIN_LABEL[review.again]}</b></p>}
      {review.note && <p className="whitespace-pre-line">„{review.note}“</p>}
    </div>
  );
}
