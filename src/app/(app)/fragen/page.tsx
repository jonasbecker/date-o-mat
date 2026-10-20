import { AppHeader } from "@/components/app-header";
import { ConversationCards } from "@/components/conversation-cards";
import { PageTitle } from "@/components/page-title";

// Static: the cards are drawn in the browser.
export default function QuestionsPage() {
  return (
    <div className="flex flex-col gap-4">
      <AppHeader />
      <PageTitle title="fragen." back="/plan">
        Für ruhige Momente beim Date: eine Karte ziehen, abwechselnd antworten.
      </PageTitle>
      <ConversationCards />
    </div>
  );
}
