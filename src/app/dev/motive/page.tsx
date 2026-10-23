import type { Metadata } from "next";
import { Suspense } from "react";
import { suggestMotif, keywordMotif } from "@/core/banners";
import { requireCouple } from "@/server/auth/dal";
import { listIdeas } from "@/server/ideas";
import { MotifTable, type MotifRow } from "./motif-table";

export const metadata: Metadata = { title: "Motive prüfen" };

// SWIPE-KARTE-V2.md §3: which banner each of your ideas gets. The suggestion comes from its words (core/banners.ts,
// nothing clear → herz); until it is taken over it is only shown, never stored. Change any row, then take the rest over.
export default function MotivePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="headline text-[40px]">motive.</h1>
      <Suspense fallback={<p className="text-muted">Lädt …</p>}>
        <Rows />
      </Suspense>
    </main>
  );
}

async function Rows() {
  const { coupleId } = await requireCouple();
  const ideas = await listIdeas(coupleId);
  const rows: MotifRow[] = ideas.map((idea) => ({
    id: idea.id,
    title: idea.title,
    stored: idea.motif,
    suggestion: suggestMotif(idea),
    sure: keywordMotif(idea) !== null,
  }));
  return <MotifTable rows={rows} />;
}
