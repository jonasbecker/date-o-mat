# Zweisamen – Design „Garten“ (Dark)

Vollständige Design-Spezifikation für alle Hauptseiten. Ersetzt für diese Seiten die älteren Dokumente (`DESIGN.md`, `MAIN-B-UND-BLUME.md`). **Die ganze App ist dunkel.**

## 0. Referenzdateien

| Datei | Inhalt |
|---|---|
| `screens/HomeB.html` | Beet (Startseite) |
| `screens/ThSwipe.html` | Swipen = Samentütchen (Logik für Weiter/Like/Match im `<script>`) |
| `screens/ThIdeen.html` | Ideen = Saatgut-Regal |
| `screens/ThArchiv.html` | Archiv = Stiel mit Foto-Blättern |
| `screens/ThSetup.html` | Setup = Gartenschuppen |
| `components/Bloom.html` | Die Blume. **Alle Maße/Winkel/Zustände werden in `renderVals()` im `<script>` berechnet**, bitte übernehmen |
| `components/BloomStates.html` | Alle 5 Stimmungen nebeneinander (Soll-Bild für die Dev-Ansicht) |

Die HTML-Dateien stammen aus einem Design-Tool und laufen nicht eigenständig. Alle Maße, Farben und Abstände stehen als Inline-Styles im Markup (absolut positioniert auf 390 × 844). `{{ … }}` sind Werte, die das `<script>` unten in `renderVals()` berechnet. `<sc-for>` = Schleife, `<sc-if>` = Bedingung, `<dc-import name="Bloom" …>` = Blumen-Komponente mit Props.

## 1. Konzept

- **Euer Beet:** Eine Blume mit Gesicht ist die Hauptfigur. Jedes erlebte Date = ein Blatt am Stiel. Ausgefallene Runde = welkes, gestricheltes Blatt.
- **Die Blume hat Stimmungen** (schläft, wartet, freut sich, blüht, traurig) und **spricht** in handgeschriebenen Sprechblasen (Caveat).
- **Garten-Sprache auf allen Seiten:** Ideen = Samen, Like = einpflanzen, Nein = Kompost, Match = keimt / Keimlinge, Frist = Gießzeit, Rhythmus = Gießrhythmus, Planen = gießen. Wo es unklar sein könnte, steht der normale Begriff klein darunter.
- **Ein Hintergrund für alle**, Personen erkennt man an Akzentfarben: **Jonas = Rosa-Ring (#E58FA6), Lotte = Blau-Ring (#4D63E8)** (wie in der bestehenden App).

## 2. Design-Tokens

```css
:root {
  --bg: #111A14;            /* Hintergrund aller Seiten */
  --surface: #1B2620;       /* Karten, Eingabefelder, Segment-Hintergrund */
  --divider: #26332B;
  --track: #1F2B24;         /* Wochenbalken */
  --text: #E7EEDF;
  --text-soft: #C9D4C4;     /* Werte in Einstellungen */
  --muted: #9FB09C;
  --muted-2: #75866F;
  --cta: #E4ECDD;           /* Primär-Buttons (Text = --bg) */
  --butter: #F5EFC6;        /* Restzeit, Sprechblasen, Samentüte, Hinweis-Banner */
  --green: #2E7D46;         /* Swipe-Button, aktives Segment */
  --like: #E58FA6;          /* Like-Button, Rosa-Akzent, Badge */
  --person-j: #E58FA6;
  --person-l: #4D63E8;

  /* Pflanze */
  --stem: #3E8E52; --leaf-a: #4FA25E; --leaf-b: #6DBA74;
  --petal-a: #F2A7BB; --petal-b: #F7C1CF; --petal-sad-a: #B48A95; --petal-sad-b: #C79AA6;
  --face: #F5D76E; --face-sad: #E6CF7A; --face-ink: #2B1D12;
  --cheek: #F2A7BB; --tear: #7FB6E8; --tongue: #E8708A;
  --pot: #D68456; --pot-rim: #C26A3F; --soil: #4A3626; --seed: #B9875A;

  /* Kategorie-Kacheln (hell auf dunkel) */
  --tile-rose: #F6DFD3;  /* Keimlinge, Text #5A2416 */
  --tile-green: #DCEBD9; --tile-butter: #F7EBC4; --tile-sky: #DCE7F5;
  --tile-lilac: #E6E0F2; --tile-light: #E7EEDF;

  --r-card: 22px; --r-tile: 22px; --r-pill: 999px;
}
```

**Schriften:** Bricolage Grotesque 400/500/700/800 (alles), DM Mono 400/500 (Meta, Labels, kleine Zahlen), **Caveat 600/700 nur für die Stimme der Blume** (Sprechblasen, Notizen, Blumenname).

**Typo-Regeln:** H1 54 px / 800 / letter-spacing −0.05em, klein geschrieben mit Punkt („ideen.“). Startseite: 70 px zweizeilig. Karten-Titel 16–20 px / 700. Meta DM Mono 10–11 px.

## 3. Gemeinsame Bausteine

- **Kopfzeile** (top 18, 36 px hoch): links „date-o-mat“ 15 px/800, rechts Kontext-Info in DM Mono 11 px `--muted` oder Avatare.
- **Avatar:** 32 px Kreis, weiß, Initiale 13 px/700. Wer dran ist: 2,5 px Ring in Personenfarbe. Zwei Avatare überlappen −7 px.
- **Tab-Leiste** (unten, 66 px, Hintergrund `--bg`): 5 Spalten: Beet, Ideen, **Swipen**, Archiv, Setup. Swipen = 60 px Kreis `--green` (auf der Swipe-Seite selbst `--like`), 22 px nach oben versetzt, 6 px Ring in `--bg`. Aktiver Tab: volle Deckkraft + 4 px Punkt darunter, inaktiv 60 %. Badge (z. B. „49“ bei Ideen): `--like`, 16 px hoch.
- **Buttons:** Primär = Pille 56 px, `--cta`, Text `--bg` 17–18 px/700. Sekundär = Pille mit 2 px Rand `--text`. Rund = 56 px Kreis `--surface`.
- **Karte:** `--surface`, Radius 22, kein Rahmen, Innenabstand 14–16 px. Zeilen in Karten mit 1 px `--divider` oben.
- **Segment-Schalter:** Pille `--bg` mit 4 px Innenabstand, aktiv `--green` + weiß.
- **Sprechblase der Blume:** `--butter` oder `--text` als Hintergrund, dunkler Text, Caveat 600 19–23 px, leicht gedreht (−3 bis −4°), weiche/ovale Form, Zipfel oder 2 Gedankenpunkte Richtung Blumenkopf. Nie eingerückt in ein Raster, sie „schwebt“ neben der Blume.
- **Blume als Mini-Figur:** Die Bloom-Komponente skaliert (z. B. `scale(0.34)` oder `0.42`) und beschnitten, um nur den Kopf zu zeigen. Stimmung passt zum Kontext.

## 4. Die Blume (Komponente)

Props: `stimmung` = `schlaeft | wartet | froh | blueht | traurig`, `blaetter` 0–5, `welk` Index des welken Blatts (−1 = keins), `grund` Hintergrundfarbe (für Mini-Varianten auf hellen Flächen).

Aufbau auf 300 × 420:

- **Topf** neutral (kein Gesicht): Rand 176 × 20 bei (62, 330) `--pot-rim`, Radius 10; Körper 156 × 72 bei (72, 348) `--pot`, `clip-path: polygon(0 0,100% 0,88% 100%,12% 100%)`.
- **Stiel** als SVG-Pfad, 6 px `--stem`, round caps: gerade `M150 336 L150 112`; traurig gebogen `M150 336 C150 260, 150 200, 182 148`.
- **Blätter**, abwechselnd rechts/links am Stiel: Ellipse, Breite `56 − i·4`, Höhe 50 %, Mitte bei y = `318 − i·26`, rechts x = 153 (Drehpunkt links Mitte), links x = `147 − Breite` (Drehpunkt rechts Mitte). Drehung ±30°, traurig ±8°. Farbe abwechselnd `--leaf-a`/`--leaf-b`. Welkes Blatt: transparent, 2 px gestrichelt `--leaf-b`, ±40°.
- **Kopf** bei (150, 112), traurig bei (182, 148) und 24° gedreht. **Blütenblätter** = Kreise gleichmäßig im Ring: Winkel `k/n·2π − π/2` (traurig +0,4 rad), Abstand `dist`, Durchmesser `d`, Farben abwechselnd.
- **Gesicht** = Scheibe `--face` (traurig `--face-sad`) in der Mitte mit Augen, Mund, ggf. Brauen, Träne, Bäckchen.

| Stimmung | Blätter n / Ø d / Abstand | Gesicht Ø | Augen | Mund | Extras |
|---|---|---|---|---|---|
| schlaeft | keine – geschlossene Knospe 68 × 80 `--leaf-a` mit 2 rosa Spitzen | 40 (transparent) | zu (∪-Bögen) | kleines o | „z z“ DM Mono |
| wartet | 8 / 32 / 38 | 60 | Punkte, leicht seitlich | kleines o | – |
| froh | 8 / 42 / 44 | 66 | Lachbögen (∩) | Lächeln | Bäckchen |
| blueht | 10 / 44 / 52 | 70 | Lachbögen | offener Mund mit Zunge | Bäckchen, 4 Funkel-Rauten `--butter` |
| traurig | 6 / 34 / 38, blasse Farben | 60 | Punkte + schräge Brauen | nach unten | Träne, 1 Blütenblatt liegt am Boden (238, 398) |

**Stimmung berechnen:**

```
erlebt in den letzten 24 h      -> 'blueht'
Runde bestätigt                 -> 'froh'
Einladung raus, wartet auf Antwort -> 'wartet'
letzte Runde ausgefallen ODER Restzeit < 12 h -> 'traurig'
sonst (neue Runde, nichts geplant) -> 'schlaeft'
```

`blaetter` = Anzahl erlebter Dates (max. 5 sichtbar), `welk` = Position einer ausgefallenen Runde unter den letzten 5.

## 5. Seiten

### 5.1 Beet (Startseite) – `HomeB.html`

| Bereich | Spezifikation |
|---|---|
| Kopfzeile | Logo links, Avatare J + L rechts; Ring bei der Person, die dran ist |
| Überschrift (left 20, top 70) | „du bist / dran.“ 70 px/800, lh 0.9, −0.055em. Andere Zustände z. B. „lotte ist / dran.“, „date / steht.“ |
| Restzeit (rechtsbündig, top 84) | „noch“ DM Mono 11 `--muted`, **„3h“ 64 px/800 `--butter`**, „bis Fr, 20 Uhr“ 13 px `--muted` |
| Wochenbalken (top 216) | MO–SO DM Mono 10 (heute in `--butter`); Balken 6 px `--track`, Füllung = vergangene Wochenzeit (`--text` 85 %), Fristmarker 3 × 16 px `--butter` |
| Blume (left 45, top 268) | Bloom 300 × 420, Stimmung siehe 4 |
| Gedankenblase (left 16, top 276) | 176 px, `--text`, Text #1B2620, Caveat 23, zentriert, ovale Form (Radius 40/34), −4°; 2 Punkte (14 px bei 190/366, 8 px bei 206/388) |
| Aktionen (top 692) | Raster `1fr 56px`: „Date planen“ + runder Pfeil-Button „Diesmal an Lotte abgeben“ (aria-label) |

**Sprüche je Stimmung (rotieren):** schläft „neue woche, neues glück. wer gießt?“ · wartet „lotte guckt grad … daumen drücken.“ · froh „juhu, wasser! donnerstag wird schön.“ · blüht „schaut mal, ein neues blatt!“ · traurig „psst … letztes mal fiel’s aus. heute vielleicht?“

### 5.2 Swipen = Samentütchen – `ThSwipe.html`

> **Ersetzt:** Samentüte und ✕/♥-Buttons gelten nicht mehr – die Karte ist jetzt „C2“ mit Bildstreifen,
> Bedienung nur per Wischen: `swipe-karte/SWIPE-KARTE.md`, `swipe-karte/screens/SwipeC.html` (Variante 2).

- Kopf: Pille „🌱-Icon + n Keimlinge“ (`--surface`, verlinkt auf Ideen). Titel „swipen.“, rechts Filter-Pille `--cta` („Gratis · Draußen“).
- **Samentüte** (330 × 446, −2° gedreht, Schatten): Hintergrund `--butter`, **gezackter oberer Rand** (clip-path mit 20 Zacken à 10 px), Text #1B2620.
  - Kopfzeile DM Mono 10, Sperrung 0.08em: „SAATGUT FÜR ZWEI“ links, „Nº 2 / 5“ rechts.
  - Bildfeld 190 px hoch, Radius 14, Pastellfarbe je Idee + 2 weiche Formen; Chip „Sorte: Stadtbummel“ unten links.
  - Titel 27 px/800, Beschreibung 14 px #4A5547.
  - Fußzeile mit gestrichelter Linie oben, 3 Spalten DM Mono 10: **KEIMZEIT** (Dauer) · **BEET** (Ort) · **KOSTEN**.
  - Dahinter die nächste Tüte als Fläche #2A3830, +5° gedreht.
- Buttons: ✕ 64 px (`--text`, Label „kompost“) und ♥ 76 px (`--like`, Glow, Label „einpflanzen“). Labels DM Mono 10 `--muted`.
- **Mini-Blume** links unten (scale 0.34, Stimmung `wartet`, nach einem Like kurz `froh`) mit Caveat-Kommentar in `--butter` („← na, was meinst du?“ / „← die gefällt mir auch!“).
- **Match-Overlay „keimt!“:** Vollbild `--bg` 95 %, gezeichneter Keimling mit 2 Blättern, „keimt!“ 68 px/800, „Ihr wollt beide: <Titel>“, Buttons „Direkt planen“ (Primär) / „Weiter swipen“ (Sekundär).
- Logik: Beide swipen getrennt. Match nur, wenn beide ♥ (einpflanzen). Die andere Person sieht vorher nicht, wie man entschieden hat.

### 5.3 Ideen = Saatgut-Regal – `ThIdeen.html`

- Kopf rechts: „49 Samen im Regal“. Titel „ideen.“.
- Eingabefeld (52 px, `--surface`, Radius 18): „Eigenen Samen einpflanzen …“ + runder +-Button `--cta`.
- **Keimlinge-Kachel** (volle Breite, 148 px, `--tile-rose`, Text #5A2416): Titel „Keimlinge“, Untertitel „eure Matches vom Swipen“, große Zahl rechts. Unten eine Reihe kleiner Töpfe mit Erde, leere Töpfe blass. Bei 0: Caveat-Text „noch alles Erde – swipt los!“. Je Match wächst in einem Topf ein Keimling. Tippen öffnet die Match-Liste.
- **Kategorie-Kacheln** (2 Spalten, 112 px, Radius 22), große Zahl oben links (30 px/800), Titel + Untertitel unten, **kleine Pflanzen-Illustration oben rechts**:

| Kategorie | Farbe | Illustration | Untertitel |
|---|---|---|---|
| Kurz | `--tile-green` | Radieschen | keimt an einem Abend |
| Lang | `--tile-butter` | Baum | wächst einen halben Tag |
| Draußen | `--tile-sky` | Sonnenblume | braucht Sonne |
| Drinnen | `--tile-lilac` | Kaktus im Topf | Fensterbank-Sorten |
| Mit Ort | `--tile-light` | Holzschild | Veedel & Rhein |
| Eigene | `--surface` + 1,5 px gestrichelter Rand | rosa Gießkanne | von euch gesät |

### 5.4 Archiv = der Stiel – `ThArchiv.html`

- Kopf rechts: „n Blatt/Blätter · seit <Monat>“. Titel „unser beet.“. Darunter Segment „Stiel | Raster“ (Raster = bisherige 2-Spalten-Ansicht).
- **Stiel-Ansicht:** senkrechter Stiel (5 px `--stem`) mittig von oben nach unten.
  - Oben: Knospe (36 px, gestrichelt `--leaf-b`) = nächstes Date, daneben Caveat `--butter` „Nº2 – kommt noch!“.
  - Jedes Date = **Foto in Blattform** (ca. 168 × 160, `border-radius: 90% 0 90% 0`, leicht gedreht, 4 px Rand `--leaf-a`), abwechselnd links/rechts, mit kurzem Blattstiel (22 × 3 px) zum Hauptstiel. Gegenüber: Avatar der planenden Person, Titel 17/700, Datum DM Mono 11, optional Chip „nochmal: unbedingt“ (`--butter`).
  - Ausgefallene Runde = gestricheltes welkes Blatt (Rand #5A6E5E, Text „welk“), daneben „Woche 43“ + „ausgefallen“ in `--muted`.
  - Neueste oben, ganz unten: Erdlinie `--soil` + Samenkorn `--seed` + Caveat „hier fing’s an · <Monat Jahr>“.

### 5.5 Setup = Gartenschuppen – `ThSetup.html`

- Kopf rechts: „der gartenschuppen“. Titel „setup.“.
- **Hinweis-Banner** (nur wenn etwas fehlt, z. B. Push aus): `--butter`, Radius 22. Links Mini-Blume (traurig, nur Kopf, scale 0.42), rechts Caveat-Text der Blume („mein wecker ist aus – so merkt ihr nicht, wann ihr dran seid.“) + Button „Push anmachen“ (`--bg` mit `--butter`-Text).
- Karte 1: „Wer gießt?“ Segment Abwechselnd / Vorschlag · **Gießrhythmus** (klein: „wie oft ein Date“) → „jede Woche“ · **Gießzeit** (klein: „Frist zum Planen“) → „2 Tage vorher, 20:00“.
- Karte 2: „Kalender für freie Abende“: beide Avatare + „beide verbunden ✓“ · **Freie Abende ab 18:00**.
- Karte 3: **Eure Blume heißt „Rosi“** (Caveat 26, „umbenennen“) + Topf-Auswahl: 3 Töpfe, aktueller mit Rand, weitere gesperrt (35 % Deckkraft) mit „neue Töpfe ab 10 & 25 Dates“.
- Der Push-Schalter selbst kann in Karte 1 oder im Banner leben. Gesperrte Töpfe = kleine Belohnung für die Serie.

## 6. Später (nicht für diesen Umbau)

Kopf der Blume dreht sich zur Person, die dran ist · Tropfen-Animation beim Senden · Blüte öffnet sich animiert bei Zusage · Blütenregen bei Match · weiche Übergänge zwischen Stimmungen · Saison-Deko · Ernte-Jahresrückblick.

## 7. Platzhalter in den Mockups

Fotos im Archiv sind Farbflächen „[Foto]“. Texte, Zahlen, Ideen und der Blumenname „Rosi“ sind Beispiele.
