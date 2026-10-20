import { Suspense } from "react";
import { LogoMark } from "@/components/logo";
import type { Rhythm } from "@/lib/domain";
import { requireCouple } from "@/server/auth/dal";
import { pushPublicKey } from "@/server/push";
import { getCoupleSettings } from "@/server/settings";
import { WelcomeSlides, type Slide } from "./welcome-slides";

const RHYTHM_TITLE: Record<Rhythm, string> = {
  weekly: "Jede Woche ein Date",
  biweekly: "Alle zwei Wochen ein Date",
  semimonthly: "Zweimal im Monat ein Date",
  monthly: "Jeden Monat ein Date",
};

export default function WelcomePage() {
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-6">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center"><LogoMark size={72} /></div>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const { user, partner, coupleId } = await requireCouple();
  const publicKey = pushPublicKey();
  const settings = await getCoupleSettings(coupleId);
  const slides: Slide[] = [
    {
      emoji: "🌱",
      title: `Willkommen, ${user.name}!`,
      text: `Der Date-O-Mat sorgt dafür, dass ${partner.name} und du regelmäßig Dates habt. Jedes Date wird ein Blatt in eurem Beet.`,
      tone: "bg-tile-green",
    },
    {
      emoji: "🔁",
      title: RHYTHM_TITLE[settings.rhythm],
      text:
        settings.mode === "alternating"
          ? `Wer die Gießkanne hat, ist dran: Termin und Idee aussuchen, „Gießen & senden“ – die andere Person sagt zu. Dann wandert die Kanne weiter.`
          : "Der Date-O-Mat schlägt euch jede Runde Termin und Idee vor – ihr müsst nur noch zusagen. Rhythmus und Modus könnt ihr jederzeit ändern.",
      tone: "bg-tile-butter",
    },
    {
      emoji: "📅",
      title: "Eure freie Zeit – automatisch",
      text: "Verbindet beide eure Google-Kalender. Der Date-O-Mat sieht nur, wann ihr belegt seid, findet gemeinsame Lücken und trägt das Date für euch beide ein.",
      tone: "bg-tile-sky",
    },
    {
      emoji: "♥",
      title: "Swipen ist das Herz",
      text: "In der Mitte unten swipt ihr beide getrennt durch Ideen. Drückt ihr beide ♥, ist es ein Match – und steht beim Planen ganz oben.",
      tone: "bg-rose",
    },
    {
      emoji: "🔔",
      title: "Damit ihr kein Date vergesst",
      text: "Der Date-O-Mat erinnert euch, wenn ihr dran seid, wenn etwas ansteht und vor dem Date. Ohne Erinnerungen vergisst man es doch.",
      tone: "bg-tile-lilac",
      push: true,
    },
  ];
  return <WelcomeSlides slides={slides} publicKey={publicKey} />;
}
