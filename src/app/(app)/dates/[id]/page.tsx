import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { Hearts } from "@/components/hearts";
import { SizeChip } from "@/components/size-chip";
import { visibleReviews, type ReviewView } from "@/core/reviews";
import { formatLongDate, formatTimeRange, genitive } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import type { User } from "@/server/db/schema";
import { pastDate } from "@/server/reviews";
import { ReviewForm } from "../review-form";
import { PhotoSection } from "../photo-section";
import { listPhotos } from "@/server/photos";
import { env } from "@/server/env";
import { DateCard } from "@/components/date-card";
import { Tabs } from "@/components/tabs";
import { coupleNow } from "@/server/clock";
import { dateForViewer, getDate } from "@/server/dates";
import { getCoupleSettings } from "@/server/settings";
import { dateExtrasFor } from "../../overview";

export default function DatePage({ params }: PageProps<"/dates/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DateDetail params={params} />
    </Suspense>
  );
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
        <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
          ← Zum Start
        </Link>
        <DateCard date={shown} me={user} partner={partner} extras={await dateExtrasFor(ctx, settings, upcoming, now)} />
      </div>
    );
  }
  const date = valid ? await pastDate(coupleId, id) : undefined;
  if (!date) notFound();
  const { mine, partner: theirs, partnerHidden } = visibleReviews(date.reviews, user.id);
  const photos = await listPhotos(coupleId, date.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <AutoRefresh />
      <Link href="/dates" className="self-start text-sm font-extrabold text-muted underline">
        ← Alle Dates
      </Link>

      <Card tone="minze" size="sm" className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[24px] font-bold leading-tight">{date.title}</h1>
          <SizeChip size={date.size} className="mt-1 shrink-0" />
        </div>
        <p className="text-sm font-bold">
          {formatLongDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr{date.location ? ` · 📍 ${date.location}` : ""}
        </p>
      </Card>

      {/* One part at a time instead of a long page. */}
      <Tabs
        label="Zum Date"
        tabs={[
          {
            key: "mine",
            label: mine ? "💗 Deine Herzen" : "💗 Bewerten",
            content: (
              <section aria-labelledby="review-heading" className="sticker flex flex-col gap-3 rounded-[24px] bg-surface p-4">
                <h2 id="review-heading" className="text-[21px] font-bold">
                  {mine ? "Deine Herzen" : "Wie war's für dich?"}
                </h2>
                {mine && <ReviewBlock person={user} review={mine} />}
                {!mine && partnerHidden && (
                  <p className="text-sm font-bold text-muted">🔒 {partner.name} hat schon bewertet – nach deinen Herzen siehst du {genitive(partner.name)}.</p>
                )}
                <ReviewForm
                  key={mine?.rating ?? 0}
                  dateId={date.id}
                  rating={mine?.rating ?? null}
                  note={mine?.note ?? null}
                  cost={date.actualCostEur ?? date.estimatedCostEur}
                />
              </section>
            ),
          },
          {
            key: "photos",
            label: photos.length ? `📸 Fotos (${photos.length})` : "📸 Fotos",
            content: <PhotoSection dateId={date.id} photos={photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))} enabled={env().photoStorage !== null} />,
          },
          {
            key: "partner",
            label: `${partner.name}`,
            content: (
              <section aria-labelledby="partner-heading" className="flex flex-col gap-3 rounded-[24px] border-[2.5px] border-dashed border-line p-4">
                <h2 id="partner-heading" className="text-[19px] font-bold">
                  So war&apos;s für {partner.name}
                </h2>
                {theirs ? (
                  <ReviewBlock person={partner} review={theirs} />
                ) : partnerHidden ? (
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    🔒 Verdeckt, bis du selbst bewertet hast – dann siehst du {genitive(partner.name)} Herzen.
                  </p>
                ) : (
                  <p className="font-bold text-muted">{partner.name} hat noch nicht bewertet.</p>
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
      {review.note && <p className="whitespace-pre-line font-semibold">„{review.note}“</p>}
    </div>
  );
}
