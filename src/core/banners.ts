// The banner library (docs/design/garten/swipe-karte-v2/, banners.json): 76 scenes, each a list of plain shapes on a
// 350 × 110 stage – no SVG, no images. An idea has one `motif` (a key); its pastel is the scene's own `bg`.
// Which scene fits an idea when none is stored: suggestMotif() – a title that matches nothing gets "herz".
import type { IdeaCategory } from "./categories";
import data from "./banners.json";

export type BannerShape = { l: number; t: number; w: number; h: number; c: string; r: string; rot: number; op: number; clip: string };
export type BannerScene = { name: string; bg: string; shapes: BannerShape[] };

export const BANNERS = data as Record<string, BannerScene>;
export type Motif = string;
export const MOTIFS: readonly Motif[] = Object.keys(BANNERS);
export const FALLBACK_MOTIF: Motif = "herz";

export const STAGE = { width: 350, height: 110 } as const;

export function isMotif(value: unknown): value is Motif {
  return typeof value === "string" && Object.hasOwn(BANNERS, value);
}

/** The scene for a key – unknown or missing: "herz". */
export function bannerOf(motif: string | null | undefined): BannerScene {
  return BANNERS[isMotif(motif) ? motif : FALLBACK_MOTIF];
}

/** Fills the box: scaled until both width and height are covered, anchored bottom center (the sides are cut). */
export function bannerScale(width: number, height: number): number {
  return Math.max(height / STAGE.height, width / STAGE.width);
}

// What a title (or note) says → its scene. First match wins, so the specific ones come before the broad ones
// ("Sterne gucken im Planetarium" is planetarium, "Eis essen" is not winter). Only what clearly fits – the rest is herz.
const KEYWORDS: Array<[RegExp, Motif]> = [
  [/planetarium/iu, "planetarium"],
  [/aquarium|sea ?life/iu, "aquarium"],
  [/\bzoo\b|tierpark|wildpark|zoologisch/iu, "zoo"],
  [/freizeitpark|phantasialand|movie ?park|achterbahn|kirmes|jahrmarkt/iu, "freizeitpark"],
  [/wasserpark|aqualand|rutschen/iu, "wasserpark"],
  [/stadion|rhein ?energie|bundesliga|1\. ?fc|\bfc\b|haie|eishockey|handball/iu, "stadion"],
  [/fußball|fussball|kicken|bolzplatz/iu, "fussball"],
  [/yoga|pilates|meditation/iu, "yoga"],
  [/shoppen|shopping|bummeln|einkaufsbummel|schildergasse|ehrenstraße|vintage[- ]?laden|second ?hand/iu, "shoppen"],
  [/flohmarkt|wochenmarkt|weihnachtsmarkt|\bmarkt\b|trödel/iu, "markt"],
  [/plattenladen|vinyl|schallplatte/iu, "plattenladen"],
  [/karaoke|mitsing/iu, "karaoke"],
  [/konzert|live ?musik|gig\b|festival|\bband\b|open ?air/iu, "konzert"],
  [/kino|film ?(premiere|festival)|open-air-kino|autokino/iu, "kino"],
  [/filmabend|serien?abend|netflix|film schauen|film gucken|movie ?night/iu, "filmabend"],
  [/theater|oper\b|musical|kabarett|comedy|impro|varieté|variete/iu, "theater"],
  [/zirkus|circus|akrobatik/iu, "zirkus"],
  [/museum|galerie|ausstellung|ludwig|kolumba/iu, "museum"],
  [/lesung|bücherei|bibliothek|buchladen|vorlesen|\blesen\b|poetry ?slam/iu, "lesen"],
  [/tanz|salsa|tango|swing|disco|club\b|clubbing/iu, "tanzen"],
  [/escape ?room|exit ?room/iu, "escape"],
  [/schnitzeljagd|geocaching|rätselrallye|stadtrallye/iu, "schnitzeljagd"],
  [/pub ?quiz|quiz/iu, "quiz"],
  [/arcade|spielhalle|flipper|retro ?games|vr[- ]?(arena|erlebnis)/iu, "arcade"],
  [/brettspiel|spieleabend|spielabend|kartenspiel|puzzle|spiele[- ]?café|spielecafé|spiele cafe/iu, "spiele"],
  [/bowling|kegeln/iu, "bowling"],
  [/minigolf|schwarzlicht ?golf|crazy ?golf/iu, "minigolf"],
  [/tischtennis|ping ?pong/iu, "tischtennis"],
  [/bouldern|klettern|kletterhalle|kletterwald/iu, "bouldern"],
  [/schlittschuh|eislaufen|eisbahn|eishalle/iu, "eislaufen"],
  [/rodeln|schlitten/iu, "rodeln"],
  [/ski\b|schnee|winterwander|glühwein/iu, "winter"],
  [/kajak|kanu|paddeln|sup\b|stand ?up|tretboot|rudern|bootfahr/iu, "kajak"],
  [/schwimm|freibad|hallenbad|agrippabad|baden gehen/iu, "schwimmen"],
  [/strand|beach|düne/iu, "strand"],
  [/badewanne|schaumbad|wannenbad/iu, "badewanne"],
  [/sauna|therme|wellness|massage|spa\b|claudius/iu, "wellness"],
  [/sonnenuntergang|sonnenaufgang|golden hour/iu, "sonnenuntergang"],
  [/sterne|sternschnuppe|sternenhimmel/iu, "sterne"],
  [/camping|zelten|zelt\b/iu, "camping"],
  [/wander|siebengebirge|eifel|drachenfels|hike|hiking/iu, "wandern"],
  [/fahrrad|radtour|rad fahren|radfahren|bike/iu, "fahrrad"],
  [/roadtrip|road ?trip|autofahrt|spritztour/iu, "roadtrip"],
  [/burg\b|schloss|ruine|festung/iu, "burg"],
  [/\breise|urlaub|städtetrip|wochenendtrip|kurztrip|zugfahrt|tagesausflug|ausflug nach/iu, "reise"],
  [/botanisch|flora\b|gewächshaus|palmenhaus/iu, "botanik"],
  [/blumen|tulpen|blumenfeld|blumen pflücken/iu, "blumen"],
  [/gärtnern|garten anlegen|pflanzen|urban gardening|kräuter/iu, "gaertnern"],
  [/flaschenpost/iu, "flaschenpost"],
  [/\bhunde?\b|hundeschule|gassi|tierheim/iu, "hund"],
  [/tiere|streichelzoo|bauernhof|pferd|alpaka|katzen ?café|katzencafé/iu, "tiere"],
  [/\bsee\b|weiher|baggersee|stausee/iu, "see"],
  [/picknick/iu, "picknick"],
  [/park\b|stadtwald|grüngürtel|volksgarten|stadtgarten|rheinpark|spaziergang|spazieren/iu, "park"],
  [/stadtführung|stadttour|altstadt|veedel|skyline|dom\b|rooftop|aussichtsplattform/iu, "stadt"],
  [/töpfer|keramik/iu, "toepfern"],
  [/malen|zeichnen|aquarell|acryl|leinwand|paint/iu, "malen"],
  [/basteln|stricken|häkeln|nähen|diy\b|kerzen ziehen|origami/iu, "basteln"],
  [/foto|fotowalk|polaroid|fotobox|fotoautomat/iu, "foto"],
  [/überraschung|ueberraschung|surprise/iu, "ueberraschung"],
  [/crêpe|crepe|waffel|pfannkuchen|pancake/iu, "crepes"],
  [/pizza/iu, "pizza"],
  [/burger/iu, "burger"],
  [/sushi|ramen|japanisch/iu, "sushi"],
  [/\beis\b|eisdiele|gelato|eis essen/iu, "eis"],
  [/brunch|frühstück/iu, "brunch"],
  [/streetfood|street ?food|food ?truck|foodmarkt|nachtmarkt/iu, "streetfood"],
  [/grill|bbq|barbecue/iu, "grill"],
  [/biergarten|kölsch|brauhaus|bier/iu, "biergarten"],
  [/cocktail|bar\b|rooftop ?bar|\bgin\b/iu, "cocktail"],
  [/wein|weinprobe|winzer|vino/iu, "wein"],
  [/kaffee|café|cafe|cappuccino|kuchen essen/iu, "kaffee"],
  [/kochen|kochkurs|backen|selbst gemacht|nudeln machen|zusammen kochen/iu, "kochen"],
  [/dinner|restaurant|essen gehen|candle ?light|abendessen|fine dining/iu, "dinner"],
];

/** The scene a title (and note) clearly asks for, or null. */
export function keywordMotif(idea: { title: string; note?: string | null }): Motif | null {
  for (const text of [idea.title, idea.note ?? ""]) {
    for (const [pattern, motif] of KEYWORDS) if (pattern.test(text)) return motif;
  }
  return null;
}

/** What an idea shows when it has no stored motif: what its words ask for – nothing clear, herz. */
export function suggestMotif(idea: { title: string; note?: string | null }): Motif {
  return keywordMotif(idea) ?? FALLBACK_MOTIF;
}

/** The editor's first choice for a new idea of a kind (the person picks another if it fits better). */
export const CATEGORY_MOTIF: Record<IdeaCategory, Motif> = {
  food: "dinner",
  nature: "park",
  culture: "museum",
  active: "fahrrad",
  creative: "malen",
  cozy: "filmabend",
  trip: "reise",
  events: "konzert",
  other: "herz",
};

/** For the prompt: the keys Claude may pick from. */
export function motifPrompt(): string {
  return MOTIFS.join(", ");
}
