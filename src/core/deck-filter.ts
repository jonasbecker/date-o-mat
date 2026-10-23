// What the phone needs of the deck's logic (core/deck.ts holds the prompts, batches and the card-art library – the
// server's part): which kind a card is, whether it fits the shared filter, the names of the event mixes.
import { categoryFromTheme, inferCategory, type IdeaCategory } from "./categories";
import { matchesIdeaFilter, type IdeaFilter } from "./filters";
import type { DeckCardKind, EventMix, IdeaSize, PlaceSetting } from "@/lib/domain";

type FilterCard = { costEur: number | null; setting: PlaceSetting | null; size: IdeaSize; theme: string | null; title: string; note: string | null; kind: DeckCardKind };

export const EVENT_MIX_LABEL: Record<EventMix, string> = { none: "Keine", some: "Ein paar", lots: "Viele" };

export function cardCategory(card: Pick<FilterCard, "theme" | "title" | "note" | "kind">): IdeaCategory {
  return categoryFromTheme(card.theme) ?? (card.kind === "combo" ? "events" : inferCategory(card.title, card.note) ?? "other");
}

export function matchesFilter(card: FilterCard, filter: IdeaFilter): boolean {
  return matchesIdeaFilter({ size: card.size, costEur: card.costEur, setting: card.setting, category: cardCategory(card) }, filter);
}
