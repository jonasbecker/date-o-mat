import Link from "next/link";
import { Card } from "@/components/card";
import { overallLevel, type StatusRow } from "@/core/system-status";
import { cn } from "@/lib/cn";

const ICON = { ok: "✅", warn: "⚠️", off: "➖" } as const;

/** "Läuft alles?" – folded when everything is fine, open when something needs you. */
export function SystemStatusCard({ rows }: { rows: StatusRow[] }) {
  const problems = rows.filter((row) => row.level === "warn").length;
  const ok = overallLevel(rows) === "ok";
  return (
    <section id="status" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="status-heading">
      <h2 id="status-heading" className="text-[21px] font-semibold">
        Läuft alles?
      </h2>
      <Card tone={ok ? "surface" : "zitrone"} className="p-0">
        <details open={!ok} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-display text-lg font-semibold">
            {ok ? "✅ Alles läuft" : `⚠️ ${problems === 1 ? "Eine Sache braucht euch" : `${problems} Dinge brauchen euch`}`}
            <span className={cn("font-sans text-sm font-extrabold underline group-open:hidden", ok ? "text-muted" : "text-tinte/75")}>Details</span>
          </summary>
          <ul className="flex flex-col gap-3 px-5 pb-5">
            {rows.map((row) => (
              <li key={row.key} className="flex gap-2.5">
                <span aria-hidden="true">{ICON[row.level]}</span>
                <span className="min-w-0">
                  <span className="block font-extrabold">{row.label}</span>
                  <span className={cn("block text-sm font-semibold", row.level === "warn" ? "" : ok ? "text-muted" : "text-tinte/75")}>
                    {row.href ? (
                      <Link href={row.href} className="underline">
                        {row.detail}
                      </Link>
                    ) : (
                      row.detail
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Card>
    </section>
  );
}
