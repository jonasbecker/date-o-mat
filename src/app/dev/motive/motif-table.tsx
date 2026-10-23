"use client";

import { useState, useTransition } from "react";
import { Banner } from "@/components/banner";
import { BANNERS, MOTIFS, bannerView } from "@/core/banners";
import { applyMotifSuggestionsAction, setIdeaMotifAction } from "./actions";

export type MotifRow = { id: string; title: string; stored: string | null; suggestion: string; sure: boolean };

const SORTED = [...MOTIFS].sort((a, b) => BANNERS[a].name.localeCompare(BANNERS[b].name, "de"));

export function MotifTable({ rows }: { rows: MotifRow[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const open = rows.filter((r) => !r.stored).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {rows.length} Ideen · {open} noch ohne festes Motiv (Vorschlag aus dem Titel, sonst „herz“).
      </p>
      <button
        type="button"
        disabled={pending || open === 0}
        onClick={() => start(async () => setDone(await applyMotifSuggestionsAction()))}
        className="press h-12 self-start rounded-full bg-cta px-5 font-bold text-bg disabled:opacity-50"
      >
        Alle {open} Vorschläge übernehmen
      </button>
      {done !== null && <p role="status" className="text-sm font-bold">{done} übernommen.</p>}
      <table className="w-full border-separate border-spacing-y-2 text-sm">
        <thead className="text-left font-mono text-[11px] uppercase text-muted">
          <tr>
            <th>Titel</th>
            <th>Motiv</th>
            <th className="sr-only">Bild</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const shown = row.stored ?? row.suggestion;
            return (
              <tr key={row.id} data-motif-for={row.title} data-motif={shown}>
                <td className="pr-2 font-bold">{row.title}</td>
                <td className="pr-2">
                  <select
                    aria-label={`Motiv für ${row.title}`}
                    value={row.stored ?? ""}
                    disabled={pending}
                    onChange={(e) => start(() => setIdeaMotifAction(row.id, e.target.value || null))}
                    className="h-10 rounded-xl bg-surface px-2"
                  >
                    <option value="">Vorschlag: {row.suggestion}{row.sure ? "" : " (nichts passt)"}</option>
                    {SORTED.map((m) => (
                      <option key={m} value={m}>
                        {m} – {BANNERS[m].name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Banner scene={bannerView(shown)} hoehe={28} breite={88} className="rounded-[8px]" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
