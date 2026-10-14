import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { Hearts } from "@/components/hearts";
import { SizeChip } from "@/components/size-chip";
import { visibleReviews, type ReviewView } from "@/core/reviews";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import type { User } from "@/server/db/schema";
import { pastDate } from "@/server/reviews";
import { ReviewForm } from "../review-form";
import { PhotoSection } from "../photo-section";
import { listPhotos } from "@/server/photos";
import { env } from "@/server/env";

export default function DatePage({ params }: PageProps<"/dates/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DateDetail params={params} />
    </Suspense>
  );
}

async function DateDetail({ params }: { params: PageProps<"/dates/[id]">["params"] }) {
  const { user, partner, coupleId } = await requireCouple();
  const { id } = await params;
  const date = /^[0-9a-f-]{36}$/.test(id) ? await pastDate(coupleId, id) : undefined;
  if (!date) notFound();
  const { mine, partner: theirs, partnerHidden } = visibleReviews(date.reviews, user.id);
  const photos = await listPhotos(coupleId, date.id);

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <Link href="/dates" className="self-start text-sm font-extrabold text-muted underline">
        ← Alle Dates
      </Link>

      <Card tone="minze" size="lg" className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[30px] font-bold leading-tight">{date.title}</h1>
          <SizeChip size={date.size} className="mt-2 shrink-0" />
        </div>
        <p className="font-bold">
          {formatLongDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)} Uhr
        </p>
        {date.location && <p className="font-bold">📍 {date.location}</p>}
      </Card>

      <section aria-labelledby="review-heading" className="sticker flex flex-col gap-4 rounded-[24px] bg-surface p-5">
        <h2 id="review-heading" className="text-[23px] font-bold">
          {mine ? "Deine Herzen" : "Wie war's für dich?"}
        </h2>
        {mine && <ReviewBlock person={user} review={mine} />}
        <ReviewForm key={mine?.rating ?? 0} dateId={date.id} rating={mine?.rating ?? null} note={mine?.note ?? null} />
      </section>

      <PhotoSection
        dateId={date.id}
        photos={photos.map((p) => ({ id: p.id, width: p.width, height: p.height }))}
        enabled={env().photoStorage !== null}
      />

      <section aria-labelledby="partner-heading" className="flex flex-col gap-3 rounded-[24px] border-[2.5px] border-dashed border-line p-5">
        <h2 id="partner-heading" className="text-[19px] font-bold">
          So war&apos;s für {partner.name}
        </h2>
        {theirs ? (
          <ReviewBlock person={partner} review={theirs} />
        ) : partnerHidden ? (
          <p className="font-bold">🔒 {partner.name} hat schon bewertet. Gib erst deine Herzen – dann siehst du {partner.name}s.</p>
        ) : (
          <p className="font-bold text-muted">{partner.name} hat noch nicht bewertet.</p>
        )}
      </section>
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
