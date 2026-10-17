import { AppHeader } from "./app-header";
import { IdeasTabs } from "./ideas-tabs";
import { QuickAdd } from "./quick-add";

type Current = Parameters<typeof IdeasTabs>[0]["current"];

/** Top of the ideas pages (💡 in the header): the three sub-tabs and "+ Idee". */
export function IdeasTop({ current }: { current: Current }) {
  return (
    <>
      <AppHeader current="ideas" action={<QuickAdd />} />
      <IdeasTabs current={current} />
    </>
  );
}
