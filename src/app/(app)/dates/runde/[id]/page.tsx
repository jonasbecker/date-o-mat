import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/auto-refresh";
import { dayLabel } from "@/core/archive";
import { formatTimeRange } from "@/lib/format";
import { archiveData } from "@/server/archive";
import { requireCouple } from "@/server/auth/dal";
import { type ArchivePerson } from "../../archive-parts";
import { WiltedLeaf } from "./wilted-leaf";

/** A round that fell through (ARCHIV.md §4, ArchivWelk.html): "fiel aus.", why, and what now. */
export default function WiltPage({ params }: PageProps<"/dates/runde/[id]">) {
  return <Wilt params={params} />;
}

async function Wilt({ params }: { params: PageProps<"/dates/runde/[id]">["params"] }) {
  const ctx = await requireCouple();
  await connection();
  const { id } = await params;
  const archive = /^[0-9a-f-]{36}$/.test(id) ? await archiveData(ctx) : undefined;
  const round = archive?.wilts.get(id);
  const leaf = archive?.leaves.find((l) => l.kind === "wilt" && l.id === id);
  if (!round || !leaf) notFound();
  const people = new Map<string, ArchivePerson>([ctx.user, ctx.partner].map((p) => [p.id, { id: p.id, name: p.name, color: p.color }]));
  const meant = round.date ? `${dayLabel(round.date.startsAt)} · ${formatTimeRange(round.date.startsAt, round.date.endsAt).split(" – ")[0]}` : null;
  return (
    <>
      <AutoRefresh />
      <WiltedLeaf
        cycleId={id}
        head={`Nº${leaf.nr} · ${leaf.day}`}
        title={round.title}
        planner={people.get(round.plannerId ?? "")}
        meant={meant}
        reason={round.cycle.wiltReason}
        note={round.cycle.wiltNote}
        hasIdea={Boolean(round.date)}
      />
    </>
  );
}
