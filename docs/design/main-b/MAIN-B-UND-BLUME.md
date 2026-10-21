# Zweisamen – Main Page „B“ + Blume mit 5 Stimmungen

Ergänzt `DESIGN.md`. **Wichtig:** Die App bleibt im bestehenden **Dark-Look**. Die Farben unten gelten für die Main Page und die Blume und ersetzen dort die hellen Pastell-Werte aus DESIGN.md.

Referenzdateien:

- `screens/HomeB.html`: Main Page (Zustand „du bist dran, Frist knapp, letztes Mal ausgefallen“)
- `components/Bloom.html`: die Blume als Komponente. **Die Logik steht im `<script>` unten (renderVals)**: alle Maße, Winkel und Zustände sind dort berechnet und lassen sich 1:1 übernehmen.
- `components/BloomStates.html`: Übersicht aller 5 Stimmungen nebeneinander

Die HTML-Dateien laufen nicht eigenständig (Laufzeit des Design-Tools fehlt). Werte aus Inline-Styles und Script übernehmen, die `{{ … }}`-Platzhalter sind die berechneten Werte aus `renderVals()`.

## 1. Farben (Dark)

```css
:root {
  --bg: #111A14;          /* Hintergrund */
  --surface: #1B2620;     /* dunkle Flächen, Abgeben-Button */
  --track: #1F2B24;       /* Wochenbalken-Hintergrund */
  --text: #E7EEDF;        /* Text, Gedankenblase */
  --muted: #9FB09C;       /* Nebentext, Meta */
  --accent-time: #F5EFC6; /* Restzeit „3h“, Fristmarker, heutiger Tag */
  --cta: #E4ECDD;         /* Primär-Button (Text #111A14) */
  --swipe: #2E7D46;       /* runder Swipe-Button in der Tab-Leiste */
  --partner-ring: #E58FA6;/* Ring um den Avatar der Person, die dran ist */

  /* Blume */
  --stem: #3E8E52;
  --leaf-a: #4FA25E;  --leaf-b: #6DBA74;
  --petal-a: #F2A7BB; --petal-b: #F7C1CF;
  --petal-sad-a: #B48A95; --petal-sad-b: #C79AA6;
  --face: #F5D76E;    --face-sad: #E6CF7A;
  --face-ink: #2B1D12;
  --cheek: #F2A7BB;   --tear: #7FB6E8;   --tongue: #E8708A;
  --pot: #D68456;     --pot-rim: #C26A3F;
}
```

Schriften: Bricolage Grotesque (400/500/700/800), DM Mono (Meta), **Caveat 600** (nur für die Sprechblase der Blume).

## 2. Main Page B (390 × 844, Positionen absolut von oben)

| Bereich | Spezifikation |
|---|---|
| Kopfzeile (top 18) | links „date-o-mat“ 15 px/800 · rechts Avatare J + L (32 px, weiß, −7 px überlappend). Wer dran ist, bekommt 2,5 px Ring `--partner-ring` |
| Überschrift (top 70, left 20) | „du bist / dran.“ zweizeilig, 70 px, 800, line-height 0.9, letter-spacing −0.055em |
| Restzeit (top 84, rechtsbündig, right 20) | „noch“ DM Mono 11 px `--muted` · **„3h“ 64 px/800 `--accent-time`** · „bis Fr, 20 Uhr“ 13 px `--muted` |
| Wochenbalken (top 216, left/right 20) | 7 Spalten MO–SO in DM Mono 10 px (heutiger Tag in `--accent-time`). Darunter Balken 6 px, Radius 3, `--track`; Füllung = vergangene Zeit der Woche (`--text`, 85 % Deckkraft); Fristmarker 3 × 16 px in `--accent-time` an der Fristposition |
| Blume (left 45, top 268) | Komponente 300 × 420, siehe Abschnitt 3 |
| Gedankenblase (left 16, top 276) | 176 px breit, `--text`-Hintergrund, Text `#1B2620`, Caveat 600 23 px, zentriert, Radius 40/34 px (ovaler Look), **rotate(−4°)**. Dazu 2 Punkte Richtung Blumenkopf: 14 px bei (190, 366), 8 px bei (206, 388). Text kommt von der Blume („psst … letztes mal fiel’s aus. heute vielleicht?“) |
| Aktionen (top 692) | Raster `1fr 56px`, Abstand 8: „Date planen“ (Pille 56 px, `--cta`, 18 px/700) + runder Button 56 px `--surface` mit Pfeil = „Diesmal an Lotte abgeben“ (aria-label!) |
| Tab-Leiste (unten, 66 px) | 5 Spalten: Beet (aktiv, Punkt darunter), Ideen, **Swipen** (60 px Kreis `--swipe`, 22 px nach oben versetzt, 6 px Ring in `--bg`), Archiv, Setup. Inaktiv 60 % Deckkraft |

**Sprechblasen-Texte** sollten zur Stimmung passen und variieren, Beispiele:
schläft: „neue woche, neues glück. wer plant?“ · wartet: „lotte guckt grad … daumen drücken.“ · freut sich: „juhu, wasser! donnerstag wird schön.“ · blüht: „schaut mal, ein neues blatt!“ · traurig: „psst … letztes mal fiel’s aus. heute vielleicht?“

## 3. Die Blume (Komponente)

Props: `stimmung` (`schlaeft | wartet | froh | blueht | traurig`), `blaetter` (0–5 sichtbare Blätter), `welk` (Index des welken Blatts, −1 = keins).

**Aufbau (300 × 420):**

- **Topf** neutral, ohne Gesicht: Rand 176 × 20 bei (62, 330) `--pot-rim`, Körper 156 × 72 bei (72, 348), Trapez `clip-path: polygon(0 0,100% 0,88% 100%,12% 100%)`.
- **Stiel** als SVG-Pfad 6 px `--stem`, von (150, 336) nach oben zum Kopf; bei „traurig“ gebogen: `M150 336 C150 260, 150 200, 182 148`.
- **Blätter** am Stiel, Ellipsen, abwechselnd rechts/links, Breite 56 − i·4 px, Höhe 50 %, y = 318 − i·26, Drehung ±30° (traurig ±8°, hängen). Welkes Blatt: transparent, 2 px gestrichelt, ±40°.
- **Kopf** bei (150, 112), bei traurig (182, 148) und 24° geneigt. Blütenblätter als Kreise im Ring um das Gesicht, abwechselnd zwei Rosatöne.
- **Gesicht** = gelbe Scheibe in der Blütenmitte, Augen/Mund/Brauen als kleine Formen (Details im Script).

| Stimmung | Blüte | Gesicht | Extra | Wann |
|---|---|---|---|---|
| schlaeft | geschlossene grüne Knospe (68 × 80) mit 2 rosa Spitzen, kein Ring | Augen zu (∪), kleiner o-Mund | „z z“ | neue Runde, noch nichts geplant |
| wartet | 8 Blätter Ø 32, Abstand 38, Gesicht Ø 60 | Punktaugen leicht seitlich, o-Mund | – | Einladung raus, andere Person muss antworten |
| froh | 8 Blätter Ø 42, Abstand 44, Gesicht Ø 66 | Lachaugen (∩), Lächeln, Bäckchen | – | Date bestätigt |
| blueht | 10 Blätter Ø 44, Abstand 52, Gesicht Ø 70 | Lachaugen, offener Mund mit Zunge, Bäckchen | 4 Funkel-Rauten `--accent-time` | Date erlebt, neues Blatt |
| traurig | 6 blasse Blätter Ø 34, Kopf hängt | Punktaugen, schräge Brauen, Träne, Mund nach unten | ein Blütenblatt liegt am Boden | Frist knapp (z. B. < 12 h) oder letzte Runde ausgefallen |

**Stimmung berechnen (Vorschlag):**

```
if (runde.status === 'erlebt' && vor < 24h) -> 'blueht'
else if (runde.status === 'bestaetigt')     -> 'froh'
else if (runde.status === 'eingeladen')     -> 'wartet'
else if (letzteRundeAusgefallen || restzeit < 12h) -> 'traurig'
else                                         -> 'schlaeft'
```

Blätter = Anzahl erlebter Dates (in der Blume max. 5 sichtbar, ältere ins Archiv); `welk` = Position einer ausgefallenen Runde unter den letzten 5.

**Später (Animationen):** Kopf dreht sich zur Person, die dran ist; beim Senden fallen Tropfen; bei Zusage öffnet sich die Blüte; bei Match fliegen Blütenblätter. Übergänge zwischen Stimmungen weich animieren (Blütenblatt-Größe/Abstand interpolieren).
