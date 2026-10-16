import { Suspense } from "react";
import { LogoMark } from "@/components/logo";
import type { Rhythm } from "@/lib/domain";
import { requireCouple } from "@/server/auth/dal";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-6">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center"><LogoMark size={72} /></div>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const { user, partner, coupleId } = await requireCouple();
  const settings = await getCoupleSettings(coupleId);
  const slides: Slide[] = [
    {
      emoji: "💞",
      title: `Willkommen, ${user.name}!`,
      text: `Der Date-O-Mat sorgt dafür, dass ${partner.name} und du regelmäßig Dates habt – ohne langes Hin und Her.`,
      tone: "bg-himbeere-soft",
    },
    {
      emoji: "🔁",
      title: RHYTHM_TITLE[settings.rhythm],
      text:
        settings.mode === "alternating"
          ? `Ihr wechselt euch ab: Wer dran ist, sucht Termin und Idee aus – die andere Person sagt „Passt!“. Rhythmus und Modus könnt ihr jederzeit ändern.`
          : "Der Date-O-Mat schlägt euch jede Runde Termin und Idee vor – ihr müsst nur noch zusagen. Rhythmus und Modus könnt ihr jederzeit ändern.",
      tone: "bg-zitrone-soft",
    },
    {
      emoji: "📅",
      title: "Eure freie Zeit – automatisch",
      text: "Verbindet beide eure Google-Kalender. Der Date-O-Mat sieht nur, wann ihr belegt seid, findet gemeinsame Lücken und trägt das Date für euch beide ein.",
      tone: "bg-himmel/30",
    },
    {
      emoji: "💡",
      title: "Ideen & Erinnerungen",
      text: "Fällt dir was ein? Gelbes + unten antippen. Unter „Ideen“ könnt ihr neue Vorschläge swipen – wischt ihr beide nach rechts, landet die Idee auf eurer Wunschliste. Was noch fehlt, zeigt euch die Startseite.",
      tone: "bg-minze-soft",
    },
  ];
  return <WelcomeSlides slides={slides} />;
}
