// Hand-picked date ideas for Köln. Costs are rough guesses for two people;
// opening times and prices change, so the UI asks to check before going.
// Ids are stable: they end up in ideas.external_ref once saved to the wishlist.

import type { IdeaSize } from "@/lib/domain";

export type Setting = "indoor" | "outdoor";

export type CuratedIdea = {
  id: string;
  title: string;
  size: IdeaSize;
  /** Rough cost for two in euros (0 = free). */
  costEur: number;
  location: string;
  setting: Setting;
  note: string;
};

export const CURATED_IDEAS: CuratedIdea[] = [
  { id: "dom-turm", title: "Auf den Domturm steigen", size: "small", costEur: 12, location: "Altstadt-Nord", setting: "outdoor", note: "Über 500 Stufen hoch – oben Blick über die ganze Stadt. Danach ein Kölsch zur Belohnung." },
  { id: "rheinboulevard-sunset", title: "Sonnenuntergang am Rheinboulevard", size: "small", costEur: 0, location: "Deutz", setting: "outdoor", note: "Auf die Stufen setzen, Getränke mitbringen und dem Dom beim Leuchten zusehen." },
  { id: "hohenzollernbruecke", title: "Liebesschloss an der Hohenzollernbrücke", size: "small", costEur: 10, location: "Deutz / Altstadt", setting: "outdoor", note: "Schloss gravieren lassen oder selbst beschriften, dann gemeinsam über die Brücke." },
  { id: "seilbahn", title: "Mit der Seilbahn über den Rhein", size: "small", costEur: 20, location: "Riehl / Rheinpark", setting: "outdoor", note: "Kurze Fahrt mit Aussicht, danach durch den Rheinpark spazieren." },
  { id: "rheinpark-picknick", title: "Picknick im Rheinpark", size: "small", costEur: 15, location: "Deutz", setting: "outdoor", note: "Decke, Snacks, Musik. Mit Glück läuft im Tanzbrunnen nebenan etwas." },
  { id: "flora", title: "Spaziergang durch die Flora", size: "small", costEur: 0, location: "Riehl", setting: "outdoor", note: "Botanischer Garten mit Gewächshäusern – schön zu jeder Jahreszeit." },
  { id: "stadtwald-tretboot", title: "Ruderboot auf dem Stadtwaldweiher", size: "small", costEur: 20, location: "Lindenthal", setting: "outdoor", note: "Boot leihen, eine Runde paddeln, danach in den Biergarten am Ufer." },
  { id: "tierpark-lindenthal", title: "Rehe gucken im Lindenthaler Tierpark", size: "small", costEur: 0, location: "Lindenthal", setting: "outdoor", note: "Kleiner Tierpark im Stadtwald, Eintritt frei. Gut mit Spaziergang kombinierbar." },
  { id: "decksteiner-weiher", title: "Runde um den Decksteiner Weiher", size: "small", costEur: 0, location: "Sülz", setting: "outdoor", note: "Ruhiger Spaziergang oder Joggen, danach Kaffee in Sülz." },
  { id: "rodenkirchen-strand", title: "Rheinstrand in Rodenkirchen", size: "small", costEur: 10, location: "Rodenkirchen", setting: "outdoor", note: "Füße in den Sand, Schiffe zählen, Eis vom Kiosk." },
  { id: "fuehlinger-see", title: "Tag am Fühlinger See", size: "large", costEur: 15, location: "Fühlingen", setting: "outdoor", note: "Schwimmen, Radeln, Picknick – im Sommer ein halber Urlaub." },
  { id: "rheinauhafen-kranhaeuser", title: "Abendspaziergang Rheinauhafen", size: "small", costEur: 0, location: "Altstadt-Süd", setting: "outdoor", note: "Vorbei an den Kranhäusern bis zum Schokoladenmuseum, Lichter auf dem Wasser." },
  { id: "streetart-ehrenfeld", title: "Street-Art-Tour durch Ehrenfeld", size: "small", costEur: 0, location: "Ehrenfeld", setting: "outdoor", note: "Selbst auf Entdeckungstour gehen, schönste Wand fotografieren, dann Falafel." },
  { id: "belgisches-viertel", title: "Café-Hopping im Belgischen Viertel", size: "small", costEur: 25, location: "Belgisches Viertel", setting: "indoor", note: "Drei Cafés, drei Kuchen, wer findet den besten?" },
  { id: "brauhaus-tour", title: "Kölsch-Tour durch die Altstadt", size: "small", costEur: 35, location: "Altstadt", setting: "indoor", note: "In jedem Brauhaus ein Kölsch, bis einer den Deckel aufs Glas legt." },
  { id: "schokoladenmuseum", title: "Schokoladenmuseum", size: "small", costEur: 35, location: "Rheinauhafen", setting: "indoor", note: "Am Schokobrunnen naschen und die eigene Tafel gestalten." },
  { id: "museum-ludwig", title: "Museum Ludwig", size: "small", costEur: 30, location: "Altstadt-Nord", setting: "indoor", note: "Pop-Art und Picasso. Jede:r sucht ein Lieblingsbild für die andere Person aus." },
  { id: "wallraf", title: "Wallraf-Richartz-Museum", size: "small", costEur: 30, location: "Altstadt-Nord", setting: "indoor", note: "Alte Meister bis Impressionismus – danach Kaffee um die Ecke." },
  { id: "rautenstrauch", title: "Rautenstrauch-Joest-Museum", size: "small", costEur: 20, location: "Neustadt-Süd", setting: "indoor", note: "Kulturen der Welt – gut für einen verregneten Nachmittag." },
  { id: "zoo", title: "Kölner Zoo", size: "large", costEur: 50, location: "Riehl", setting: "outdoor", note: "Elefantenpark und Regenwaldhaus. Lässt sich gut mit der Seilbahn verbinden." },
  { id: "aquarium", title: "Aquarium im Zoo", size: "small", costEur: 25, location: "Riehl", setting: "indoor", note: "Bunte Fische und Krokodile – ruhig und überraschend romantisch." },
  { id: "kino-odeon", title: "Programmkino-Abend", size: "small", costEur: 25, location: "z. B. Südstadt oder Ehrenfeld", setting: "indoor", note: "Kleines Kino, Film, den keiner von euch kennt, danach drüber reden." },
  { id: "comedy", title: "Comedy- oder Improabend", size: "small", costEur: 40, location: "Innenstadt", setting: "indoor", note: "Köln hat viele kleine Bühnen – einfach gemeinsam lachen." },
  { id: "kd-schiff", title: "Rheinschifffahrt", size: "large", costEur: 40, location: "Altstadt (Anleger)", setting: "outdoor", note: "Panoramafahrt oder bis nach Königswinter – mit Kaffee an Deck." },
  { id: "bouldern", title: "Bouldern gehen", size: "small", costEur: 35, location: "verschiedene Hallen", setting: "indoor", note: "Ohne Seil, ohne Vorwissen – Schuhe kann man leihen." },
  { id: "escape-room", title: "Escape Room", size: "small", costEur: 60, location: "verschiedene Anbieter", setting: "indoor", note: "60 Minuten Rätseln als Team. Wer übernimmt die Führung?" },
  { id: "toepfern", title: "Töpferkurs", size: "small", costEur: 70, location: "verschiedene Ateliers", setting: "indoor", note: "Zwei Tassen füreinander töpfern, später zusammen abholen." },
  { id: "kochkurs", title: "Kochkurs zu zweit", size: "small", costEur: 100, location: "verschiedene Kochschulen", setting: "indoor", note: "Eine neue Küche lernen und das Ergebnis direkt zusammen essen." },
  { id: "flohmarkt", title: "Flohmarkt-Bummel", size: "small", costEur: 20, location: "z. B. Ehrenfeld oder Nippes", setting: "outdoor", note: "Jede:r hat 10 € und kauft dem anderen das schrägste Geschenk." },
  { id: "wochenmarkt-fruehstueck", title: "Wochenmarkt & Frühstück", size: "small", costEur: 25, location: "Nippes (Wilhelmplatz)", setting: "outdoor", note: "Frische Brötchen, Käse und Obst kaufen und zuhause groß frühstücken." },
  { id: "claudius-therme", title: "Thermen-Tag", size: "large", costEur: 70, location: "Deutz (Rheinpark)", setting: "indoor", note: "Warmes Wasser, Sauna, abschalten. Perfekt im Winter." },
  { id: "drachenfels", title: "Wanderung auf den Drachenfels", size: "large", costEur: 30, location: "Königswinter", setting: "outdoor", note: "Mit der Bahn ins Siebengebirge, hochwandern, Aussicht über den Rhein." },
  { id: "bruehl-schloss", title: "Schloss Augustusburg in Brühl", size: "large", costEur: 40, location: "Brühl", setting: "outdoor", note: "Schlosspark mit Blumenbeeten, kurze Bahnfahrt von Köln." },
  { id: "bonn-rheinaue", title: "Ausflug in die Bonner Rheinaue", size: "large", costEur: 20, location: "Bonn", setting: "outdoor", note: "Riesiger Park, Tretboote, und danach durch die Bonner Altstadt." },
  { id: "aachen", title: "Tagesausflug nach Aachen", size: "large", costEur: 60, location: "Aachen", setting: "outdoor", note: "Dom, Printen, Thermalbrunnen – eine Stunde mit dem Zug." },
  { id: "ahr-wanderung", title: "Rotweinwanderweg an der Ahr", size: "large", costEur: 60, location: "Ahrtal", setting: "outdoor", note: "Weinberge, Aussichten, Einkehr in einer Straußwirtschaft." },
  { id: "spieleabend-cafe", title: "Brettspiel-Café", size: "small", costEur: 20, location: "Innenstadt", setting: "indoor", note: "Ein neues Spiel lernen – Revanche ausdrücklich erlaubt." },
  { id: "rad-tour-rhein", title: "Radtour am Rhein entlang", size: "large", costEur: 0, location: "ab Rheinauhafen Richtung Süden", setting: "outdoor", note: "Immer am Ufer entlang bis Rodenkirchen oder weiter, Pausen nach Lust." },
  { id: "karaoke", title: "Karaoke-Abend", size: "small", costEur: 40, location: "Innenstadt", setting: "indoor", note: "Ein Duett ist Pflicht. Die Songauswahl trifft jeweils die andere Person." },
  { id: "sternwarte", title: "Sterne gucken im Bergischen Land", size: "small", costEur: 10, location: "außerhalb der Stadt", setting: "outdoor", note: "In einer klaren Nacht raus aus dem Lichtsmog, Decke und Tee mitnehmen." },
];

export type CuratedFilter = { size?: IdeaSize; setting?: Setting; maxCostEur?: number };

export function filterCurated(ideas: CuratedIdea[], filter: CuratedFilter): CuratedIdea[] {
  return ideas.filter(
    (idea) =>
      (!filter.size || idea.size === filter.size) &&
      (!filter.setting || idea.setting === filter.setting) &&
      (filter.maxCostEur === undefined || idea.costEur <= filter.maxCostEur),
  );
}
