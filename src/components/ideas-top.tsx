import { AppHeader } from "./app-header";
import { QuickAdd } from "./quick-add";

/** Top of the ideas pages (💡 in the header): "+ Idee" and, if the page has none of its own, a title. */
export function IdeasTop({ title }: { title?: string }) {
  return (
    <>
      <AppHeader current="ideas" action={<QuickAdd />} />
      {title && <h1 className="-mt-1 text-[26px] font-bold leading-tight">{title}</h1>}
    </>
  );
}
