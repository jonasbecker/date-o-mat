import Link from "next/link";
import { ConversationCards } from "@/components/conversation-cards";

// Static: the cards are drawn in the browser.
export default function QuestionsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/plan" className="self-start text-sm font-extrabold text-muted underline">
          ← Zurück
        </Link>
        <h1 className="headline lowercase text-[clamp(34px,10vw,46px)] after:content-['.']">Gesprächskarten</h1>
        <p className="font-semibold text-muted">Für ruhige Momente beim Date: eine Karte ziehen, abwechselnd antworten.</p>
      </div>
      <ConversationCards />
    </div>
  );
}
