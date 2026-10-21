# Zweisamen – Design-Spezifikation „Pastell & rund“

Diese Datei beschreibt das neue Design der App. Die Mockups liegen als HTML-Dateien in `screens/`. Sie dienen als **visuelle Referenz**: Alle Maße, Farben und Abstände stehen als Inline-Styles direkt im Markup. Die Dateien laufen nicht eigenständig (sie brauchen die Laufzeit des Design-Tools), aber sie lassen sich lesen.

## 1. Konzept

- **Euer Beet:** Auf dem Startscreen steht eine Pflanze. **Jedes erlebte Date wird ein Blatt.** Eine ausgefallene Runde ist ein welkes, gestrichelt umrandetes Blatt. Oben am Stiel sitzt eine Knospe: Das ist das nächste Blatt.
- **Gießkanne = wer dran ist:** Die Person, die am Zug ist, hat die Gießkanne. Sie plant das Date („gießen“), danach geht die Kanne zur anderen Person.
- **Swipen ist das Hauptfeature:** Beide swipen getrennt durch Date-Ideen. Nur wenn **beide ♥** drücken, wird es ein **Match**. Matches landen bei den Ideen und stehen beim Planen ganz oben.
- **Ein Hintergrund für alle:** Die Hintergrundfarbe wechselt nicht danach, wer dran ist. Personen erkennt man nur an Akzentfarben.

## 2. Design-Tokens

```css
:root {
  /* Flächen */
  --bg: #EEF2E6;          /* Salbei – Hintergrund aller Screens */
  --card: #FFFFFF;        /* Karten, Felder */
  --soft: #EDF3EA;        /* Chips, Eingabefelder, inaktive Segmente */

  /* Text */
  --ink: #163A22;         /* Haupttext, primäre Buttons */
  --muted: #56604F;       /* Nebentext */

  /* Pflanze */
  --leaf: #2E7D46;        /* Stiel, Blätter */
  --leaf-light: #5BAE6A;  /* jedes 3. Blatt heller */
  --pot: #D97B52;         /* Topf */
  --pot-rim: #C9693F;     /* Topfrand */
  --bud: #F2A7BB;         /* Knospe / neues Blatt */

  /* Personen (nur Akzente!) */
  --jonas: #2F5BFF;       /* Ring am Avatar, Gießkanne, Tropfen, „Gießen & senden“ */
  --partner: #E58FA6;     /* Ring am Avatar, Gießkanne, Like-Button */
  --partner-ink: #5A2416; /* Text auf Rosé */
  --rose: #F6DFD3;        /* Match-Kachel, Match-Chip */

  /* Kategorie-Kacheln */
  --tile-green: #DCEBD9;
  --tile-butter: #F7EBC4;
  --tile-sky: #DCE7F5;
  --tile-lilac: #E6E0F2;

  /* Radien */
  --r-card: 22px;         /* 18–24 px */
  --r-tile: 22px;
  --r-pill: 999px;
}
```

## 3. Typografie

- **Schrift:** Bricolage Grotesque (Google Fonts, Gewichte 400/500/700/800), **DM Mono** für Meta-Infos.
- **H1:** 800, 54–62 px, line-height 0.92, letter-spacing −0.045em, **klein geschrieben und mit Punkt** („ideen.“, „swipen.“, „unser beet.“).
- **Karten-Titel:** 700, 16–20 px. **Text:** 400–500, 13–16 px, Farbe `--muted`.
- **Meta:** DM Mono 11 px (z. B. „Nº15 · Do 22.10.“).
- So wenig Text wie möglich: keine Erklärzeilen, keine Labels, wenn ein Icon reicht.

## 4. Bausteine

| Baustein | Aussehen |
|---|---|
| Primär-Button | Pille, `--ink` Hintergrund, weiß, 56–58 px hoch, 17–18 px / 700 |
| Senden-Button | wie Primär, aber `--jonas` (nur bei „Gießen & an S. senden“, Onboarding-Start) |
| Sekundär-Button | Pille, transparent, 2 px Rand `--ink` |
| Chip | Pille 28 px hoch, `--soft` oder weiß, DM Mono 11 px |
| Match-Chip | `--rose` mit `--partner-ink`, Text „♥ match“ |
| Karte | weiß, Radius 18–24 px, **kein Rahmen**, kein Schatten (Ausnahme: Swipe-Karte) |
| Kategorie-Kachel | 2-spaltiges Raster, 112 px hoch, Pastellfarbe, große Zahl oben (800, 30 px), Titel + Untertitel unten, Deko-Form oben rechts |
| Avatar | 30 px Kreis, weiß, Initiale; Ring 2 px in Personenfarbe, wenn die Person dran ist |
| Tab-Leiste | 5 Icons (Beet, Ideen, **Swipen**, Archiv, Setup). Swipen ist ein 60 px großer Kreis in der Mitte, 18 px nach oben versetzt. Aktiver Tab: volle Deckkraft + 4 px Punkt darunter, inaktiv 60 % |
| Fortschritt | 4 Punkte (6 px), der aktive ist 22 px breit |

**Pflanze (CSS/SVG, keine Bilddatei):** Stiel 4 px, Blätter als Ellipsen (Breite 64 px, nach oben jeweils −2,4 px, Höhe 56 % der Breite), abwechselnd links und rechts, um ±28° gedreht, Abstand 22 px. Welkes Blatt: transparent mit 2 px gestricheltem Rand, nach unten gedreht (±34°). Knospe: 36 px Kreis, gestrichelt (wartet) oder gefüllt `--bud` (die andere Person ist dran / neues Blatt). Topf: Trapez mit Rand.

## 5. Screens (Dateien in `screens/`)

| # | Datei | Inhalt |
|---|---|---|
| 0 | `MOnboarding` | Beet anlegen: 1 Partnerin einladen (Code + Link teilen), 2 Google Kalender verbinden (nur frei/belegt), 3 Rhythmus (jede Woche / alle 2 Wo. / monatlich). CTA „Los geht’s · erste Ideen swipen“ |
| 1 | `MBeet` (seite=du) | Start: „du bist dran.“, Pflanze, blaue Kanne kippt mit Tropfen, CTA „Date planen“ |
| 2 | `MPlan` | „wann?“ = gemeinsame freie Abende aus beiden Kalendern (weiße Karten, gewählte Karte `--ink`), „was?“ = Ideen, Matches zuerst mit „♥ match“. Unten Zusammenfassung + „Gießen & an S. senden“ |
| 3 | `MBeetSie` (seite=sie) | Warten: „kanne bei S.“, Pille mit dem gesendeten Date, Knospe gefüllt, rosa Kanne oben, Button „Anstupsen“ |
| 4 | `MEinladung` | Handy der Partnerin: „Jonas hat gegossen.“, Karte mit wann/wo/was/Notiz, „In beiden Kalendern frei“, Buttons „Zusagen“ / „Anderer Termin“ (= Gegenvorschlag, Kanne geht zurück) |
| 5 | `MBestaetigt` | „neues blatt!“, Pflanze mit leuchtendem rosa Blatt Nº15, Chips „✓ in beiden Kalendern“, „Erinnerung Do 17:30“ |
| 6 | `MIdeen` | Feld für eigene Ideen, große Kachel „Eure Matches – vom Swipen“, darunter Kategorie-Kacheln: Klein, Groß, Draußen, Drinnen, In Köln, Eigene |
| 7 | `MArchiv` | „unser beet.“: Foto-Kacheln, immer 2 nebeneinander, mit Foto (170 px hoch), Titel, Datum (DM Mono) und Personenpunkt oben links. Ausgefallene Runde = gestrichelte Kachel ohne Foto |
| 8 | `MSetup` | Wer plant (Abwechselnd / Wer Lust hat), Rhythmus, Frist, Push-Erinnerung, beide Google-Kalender, „Freie Abende ab 18:00“ |
| 9 | `MFoto` | Nach dem Date: „wie war’s?“, Foto-Upload-Feld, „Nochmal machen?“ (nö / vielleicht / unbedingt), „Blatt speichern“ |
| ★ | `MSwipe` | Swipe-Karte (Bildbereich in Pastell, Quelle als Chip, Titel 30 px, Beschreibung, Tags), dahinter die nächste Karte leicht gedreht. Buttons ✕ (weiß) und ♥ (`--partner`). Oben „♥ 5 Matches“ |
| ★ | `MSwipeMatch` | Vollbild-Overlay in `--ink` mit 94 % Deckkraft: Avatare J+S, „match!“, Idee, „Direkt planen“ / „Weiter swipen“ |
| – | `MStil` | Übersicht über Farben, Schrift und Bausteine |

## 6. Verhalten

- **Abwechseln:** Pro Runde (z. B. Woche) ist genau eine Person „dran“. Status pro Runde: offen → geplant (Einladung raus) → bestätigt → erlebt (Blatt wächst) bzw. ausgefallen (welkes Blatt), wenn die Frist abläuft.
- **Gegenvorschlag:** „Anderer Termin“ öffnet das Planen für die Partnerin; die Kanne wechselt die Seite.
- **Swipen:** Jede Person bewertet Ideen getrennt. Haben beide ♥, entsteht ein Match (Overlay sofort bei der zweiten Person). Die Partnerin sieht vorher nicht, wie die andere Person entschieden hat.
- **Push:** Erinnerung, wenn man dran ist, und kurz vor der Frist; Benachrichtigung bei neuer Einladung und bei Match.

## 7. Was in den Mockups Platzhalter ist

- Fotos im Archiv sind Farbflächen mit „[Foto]“. Für echte Fotos braucht es Upload + Speicher.
- Ideen, Termine, Namen („S.“) und Zahlen sind Beispieldaten.
