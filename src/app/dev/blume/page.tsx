import type { Metadata } from "next";
import { Bloom } from "@/components/bloom";
import type { Stimmung } from "@/core/bloom";

export const metadata: Metadata = { title: "Die Blume – 5 Stimmungen" };

// The five moods side by side, as in docs/design/main-b/components/BloomStates.html – to compare.
const STATES: Array<{ stimmung: Stimmung; blaetter: number; welk: number; title: string; text: string }> = [
  { stimmung: "schlaeft", blaetter: 0, welk: -1, title: "schläft", text: "Neue Runde, noch nichts geplant. Knospe zu." },
  { stimmung: "wartet", blaetter: 3, welk: -1, title: "wartet", text: "Einladung raus, schaut zu der Person, die antworten muss." },
  { stimmung: "froh", blaetter: 4, welk: -1, title: "freut sich", text: "Date steht. Blüte geht auf." },
  { stimmung: "blueht", blaetter: 5, welk: -1, title: "blüht", text: "Date erlebt. Volle Blüte, neues Blatt, Funkeln." },
  { stimmung: "traurig", blaetter: 3, welk: 1, title: "traurig", text: "Frist knapp oder Runde ausgefallen. Kopf hängt, Blatt fällt." },
];

export default function BloomStatesPage() {
  return (
    <main className="min-h-dvh overflow-x-auto bg-[#111A14] px-[50px] py-12 text-[#E7EEDF]">
      <div className="flex w-[1700px] flex-col gap-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-[32px] font-extrabold tracking-[-0.03em]">die blume.</h1>
          <span className="font-mono text-xs text-[#9FB09C]">Gesicht sitzt in der Blüte · Blätter darunter = eure Dates · Topf bleibt neutral</span>
        </div>
        <div className="grid grid-cols-[repeat(5,300px)] gap-[25px]">
          {STATES.map((s) => (
            <div key={s.stimmung} className="flex flex-col gap-3">
              <Bloom stimmung={s.stimmung} blaetter={s.blaetter} welk={s.welk} className="h-[420px] w-[300px]" />
              <span className="text-[17px] font-bold">{s.title}</span>
              <span className="text-[13px] text-[#9FB09C]">{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
