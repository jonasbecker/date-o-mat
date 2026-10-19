// What kind of date an idea is: Essen, Natur, Kultur … The wishlist is browsed by these.
// Ideas get a category when they are made (swipe cards bring theirs) – and when they have none,
// it is guessed from title and note, so nothing has to be sorted by hand. Pure.

export const IDEA_CATEGORIES = ["food", "nature", "culture", "active", "creative", "cozy", "trip", "events", "other"] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<IdeaCategory, { emoji: string; label: string }> = {
  food: { emoji: "🍜", label: "Essen & Trinken" },
  nature: { emoji: "🌳", label: "Natur" },
  culture: { emoji: "🎭", label: "Kultur" },
  active: { emoji: "🧗", label: "Aktiv" },
  creative: { emoji: "🎨", label: "Kreativ" },
  cozy: { emoji: "🛋️", label: "Gemütlich" },
  trip: { emoji: "🚆", label: "Ausflug" },
  events: { emoji: "🎟️", label: "Events" },
  other: { emoji: "✨", label: "Sonstiges" },
};

export function isCategory(value: unknown): value is IdeaCategory {
  return (IDEA_CATEGORIES as readonly unknown[]).includes(value);
}

/** The swipe deck's themes (see DECK_THEMES) map onto categories. */
const THEME_TO_CATEGORY: Record<string, IdeaCategory> = {
  food: "food",
  nature: "nature",
  culture: "culture",
  active: "active",
  creative: "creative",
  cozy: "cozy",
  trip: "trip",
  night: "events",
  learn: "culture",
  romantic: "cozy",
};

export function categoryFromTheme(theme: string | null | undefined): IdeaCategory | null {
  return (theme && THEME_TO_CATEGORY[theme]) || null;
}

// First match wins, so the order is the order of "what it is mostly about".
const KEYWORDS: Array<[IdeaCategory, RegExp]> = [
  ["events", /konzert|festival|lesung|comedy|kabarett|open[- ]?air|stadtfest|markt\b|weihnachtsmarkt|\bevent\b/iu],
  ["trip", /ausflug|tagesausflug|wochenendtrip|städtetrip|bonn|düsseldorf|aachen|eifel|siebengebirge|mosel|zugfahrt|\btrip\b/iu],
  ["food", /essen|brunch|frühstück|restaurant|kochen|kochabend|ramen|sushi|pizza|burger|kaffee|café|cafe|eis\b|(?<!\p{L})bar\b|cocktail|(?<!\p{L})wein|(?<!\p{L})bier|kölsch|picknick|grillen|backen|streetfood|street food|dinner/iu],
  ["active", /klettern|bouldern|kletterhalle|laufen|joggen|(?<!\p{L})rad\b|fahrrad|schwimmen|freibad|skaten|schlittschuh|minigolf|bowling|lasertag|tanzen|sport|yoga|wandern|trampolin|tretboot|ruderboot|paddeln/iu],
  ["nature", /park|wald|rhein|see\b|weiher|spaziergang|garten|wiese|strand|sonnenuntergang|sterne|natur|draußen|zoo|tierpark|botanisch/iu],
  ["culture", /museum|theater|kino|film|ausstellung|galerie|oper|konzert|führung|stadtführung|planetarium|lesen|buchladen|dom\b|turm/iu],
  ["creative", /töpfern|malen|basteln|zeichnen|nähen|workshop|kurs\b|fotografieren|schreiben|musik machen|handwerk/iu],
  ["cozy", /spieleabend|brettspiel|serien|filmabend|sofa|zuhause|decke|(?<!\p{L})tee\b|kuscheln|massage|wellness|sauna|therme|(?<!\p{L})bad\b|kerzen|zu hause/iu],
];

export function inferCategory(title: string, note?: string | null): IdeaCategory | null {
  const text = `${title} ${note ?? ""}`;
  for (const [category, pattern] of KEYWORDS) if (pattern.test(title)) return category;
  // The note only decides when the title says nothing.
  for (const [category, pattern] of KEYWORDS) if (note && pattern.test(text)) return category;
  return null;
}

/** The category an idea shows under: the stored one, a guess from its words, or "Sonstiges". */
export function categoryOf(idea: { category?: string | null; title: string; note?: string | null }): IdeaCategory {
  if (isCategory(idea.category)) return idea.category;
  return inferCategory(idea.title, idea.note) ?? "other";
}

/** Categories that occur in a list, in the usual order, with how many ideas each has. */
export function categoryCounts(items: Array<{ category?: string | null; title: string; note?: string | null }>): Array<{ category: IdeaCategory; count: number }> {
  const counts = new Map<IdeaCategory, number>();
  for (const item of items) {
    const category = categoryOf(item);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return IDEA_CATEGORIES.filter((c) => counts.has(c)).map((category) => ({ category, count: counts.get(category)! }));
}
