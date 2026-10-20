import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, PageSkeleton } from "@/components/app-header";
import { PageTitle } from "@/components/page-title";
import { DateTime } from "luxon";
import { APP_TIMEZONE } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { getCoupleSettings } from "@/server/settings";
import { storyFor, storyYears } from "@/server/story";
import { StoryViewer } from "./story-viewer";

export default function StoryPage({ searchParams }: PageProps<"/story">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <AppHeader />
      <PageTitle title="story." back="/dates" backLabel="Zum Archiv" />
      <Suspense fallback={<PageSkeleton />}>
        <Story searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Story({ searchParams }: { searchParams: PageProps<"/story">["searchParams"] }) {
  const ctx = await requireCouple();
  await connection();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const params = await searchParams;
  const years = await storyYears(ctx.coupleId, now);
  const current = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).year;
  const asked = typeof params.year === "string" ? Number(params.year) : NaN;
  const year = Number.isInteger(asked) && asked > 2000 && asked <= current ? asked : (years[0] ?? current);
  const slides = await storyFor(ctx, year, now);
  return (
    <>
      {years.length > 1 && (
        <nav aria-label="Jahre" className="flex gap-1.5">
          {years.map((y) => (
            <Link
              key={y}
              href={`/story?year=${y}`}
              aria-current={y === year ? "page" : undefined}
              className={cn("rounded-full px-3 py-1 text-[13px] font-extrabold", y === year ? "bg-ink text-bg" : "bg-surface")}
            >
              {y}
            </Link>
          ))}
        </nav>
      )}
      {/* A new year → start at the first slide again. */}
      <StoryViewer key={year} slides={slides} />
    </>
  );
}
