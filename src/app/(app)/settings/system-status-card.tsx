import Link from "next/link";
import { Card } from "@/components/card";
import { overallLevel, type StatusRow } from "@/core/system-status";
import { cn } from "@/lib/cn";

const ICON = { ok: "✅", warn: "⚠️", off: "➖" } as const;

/** "Läuft alles?" – every part of the app with its state. */
export function SystemStatusCard({ rows }: { rows: StatusRow[] }) {
  const problems = rows.filter((row) => row.level === "warn").length;
  const ok = overallLevel(rows) === "ok";
  return (
    <Card tone={ok ? "surface" : "zitrone"} className="flex flex-col gap-3">
      <p className="font-display text-lg font-semibold">{ok ? "✅ Alles läuft" : `⚠️ ${problems === 1 ? "Eine Sache braucht euch" : `${problems} Dinge brauchen euch`}`}</p>
      <ul className="flex flex-col gap-3">
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
    </Card>
  );
}
