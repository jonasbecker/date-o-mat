import { AppHeader } from "./app-header";
import { IdeasTabs } from "./ideas-tabs";
import { QuickAdd } from "./quick-add";

type Current = Parameters<typeof IdeasTabs>[0]["current"];

/** Top of the ideas pages (💡 in the header): the three sub-tabs and "+ Idee". */
export function IdeasTop({ current }: { current: Current }) {
  return (
    <>
      <AppHeader current="ideas" />
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-muted">Sammelt, was ihr machen wollt.</p>
        <QuickAdd />
      </div>
      <IdeasTabs current={current} />
    </>
  );
}
