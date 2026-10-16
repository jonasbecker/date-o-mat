import { Suspense } from "react";
import { requireCouple } from "@/server/auth/dal";
import { AppHeader } from "./app-header";
import { IdeasTabs } from "./ideas-tabs";
import { QuickAdd } from "./quick-add";

type Current = Parameters<typeof IdeasTabs>[0]["current"];

/** Top of the Ideen tab: header, the three sub-tabs and "+ Idee". */
export function IdeasTop({ current }: { current: Current }) {
  return (
    <>
      <Suspense fallback={<div className="h-11" />}>
        <Header />
      </Suspense>
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-muted">Sammelt, was ihr machen wollt.</p>
        <QuickAdd />
      </div>
      <IdeasTabs current={current} />
    </>
  );
}

async function Header() {
  const { user, partner } = await requireCouple();
  return <AppHeader user={user} partner={partner} />;
}
