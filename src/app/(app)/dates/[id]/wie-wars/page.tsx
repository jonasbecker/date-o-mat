import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { dayLabel } from "@/core/archive";
import { visibleReviews } from "@/core/reviews";
import { archiveData } from "@/server/archive";
import { requireCouple } from "@/server/auth/dal";
import { env } from "@/server/env";
import { WieWarsForm } from "./wie-wars-form";

/** "wie war's?" after a date (ARCHIV.md §3, ArchivWieWars.html): photos, "nochmal?", a sentence – then the leaf. */
export default function WieWarsPage({ params }: PageProps<"/dates/[id]/wie-wars">) {
  return <WieWars params={params} />;
}

async function WieWars({ params }: { params: PageProps<"/dates/[id]/wie-wars">["params"] }) {
  const ctx = await requireCouple();
  await connection();
  const { id } = await params;
  const archive = /^[0-9a-f-]{36}$/.test(id) ? await archiveData(ctx, id) : undefined;
  const entry = archive?.dates.get(id);
  const leaf = archive?.leaves.find((l) => l.kind === "date" && l.id === id);
  if (!entry || !leaf) notFound();
  const { mine, partnerHidden } = visibleReviews(entry.reviews, ctx.user.id);
  const partnerAnswered = entry.reviews.some((r) => r.userId === ctx.partner.id);
  return (
    <>
      <AutoRefresh />
      <WieWarsForm
        dateId={entry.id}
        head={`Nº${leaf.nr} · ${dayLabel(entry.startsAt)}`}
        title={entry.title}
        partnerName={ctx.partner.name}
        photoIds={entry.photoIds}
        canUpload={env().photoStorage !== null}
        initial={{ again: mine?.again ?? null, note: mine?.note ?? "" }}
        cost={entry.costEur}
        partnerWaiting={partnerAnswered && (partnerHidden || !mine)}
      />
    </>
  );
}
