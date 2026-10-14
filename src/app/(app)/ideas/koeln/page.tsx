import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { IdeasTabs } from "@/components/ideas-tabs";
import { CURATED_IDEAS } from "@/core/curated-ideas";
import { requireCouple } from "@/server/auth/dal";
import { listIdeas } from "@/server/ideas";
import { CuratedList } from "./curated-list";

export default function KoelnPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[30px] font-bold">Köln-Ideen</h1>
      <IdeasTabs current="koeln" />
      <Suspense fallback={<PageSkeleton />}>
        <Koeln />
      </Suspense>
    </div>
  );
}

async function Koeln() {
  const { coupleId } = await requireCouple();
  const saved = (await listIdeas(coupleId)).filter((i) => i.source === "curated").map((i) => i.externalRef!);
  return <CuratedList ideas={CURATED_IDEAS} saved={saved} />;
}
