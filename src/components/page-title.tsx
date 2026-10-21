import Link from "next/link";
import { BackIcon } from "./icons";

/**
 * The title of a page under the small name (`AppHeader`): the big lowercase headline with a period.
 * A sub page gets the round arrow in front (always to the page it came from) and a smaller headline –
 * every screen looks the same, whichever topic it belongs to.
 */
export function PageTitle({ title, back, backLabel = "Zurück", children }: { title: string; back?: string; backLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        {back && (
          <Link href={back} aria-label={backLabel} className="tap flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
            <BackIcon width={18} height={18} />
          </Link>
        )}
        {/* A long single word ("einstellungen.") gets smaller on narrow phones instead of breaking mid-word. */}
        <h1 className={`headline min-w-0 text-balance break-words ${back ? "text-[40px]" : title.length > 11 && !title.includes(" ") ? "text-[min(54px,10.8vw)]" : "text-[54px]"}`}>{title}</h1>
      </div>
      {children && <p className="text-sm font-semibold text-muted">{children}</p>}
    </div>
  );
}
