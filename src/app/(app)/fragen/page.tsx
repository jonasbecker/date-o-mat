import Link from "next/link";
import { ConversationCards } from "@/components/conversation-cards";

// Static: the cards are drawn in the browser.
export default function QuestionsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/dates" className="self-start text-sm font-extrabold text-muted underline">
          ← Unsere Dates
        </Link>
        <h1 className="text-[30px] font-bold">Gesprächskarten</h1>
        <p className="font-semibold text-muted">Für ruhige Momente beim Date: eine Karte ziehen, abwechselnd antworten.</p>
      </div>
      <ConversationCards />
    </div>
  );
}
