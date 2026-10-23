# zweisamen – Swipe-Karte V2 „Kacheln" + Banner-Bibliothek + Vollbild

**Ersetzt** den Kartenaufbau aus `SWIPE-KARTE.md` (Abschnitt 2) und das aktuelle Vollbild. Seitenrahmen (Kopf, „swipen.", Kartenstapel, Blume + Sprechblase, Navigation) bleibt wie bei euch gebaut. Alle Maße für 390 × 844.

Referenzen in `screens/` (Prop `variante="2"` ist die gewählte, die Varianten 1 und 3 im Script **ignorieren**):

| Datei | Inhalt |
|---|---|
| `Karte.html` | Karte (`ansicht="karte"`) und Vollbild (`ansicht="voll"`) |
| `KarteVoll.html` | Wrapper: Vollbild |
| `KarteZoo.html` | Wrapper: Karte mit Motiv „zoo" |
| `Banner.html` | Banner-Komponente (Props `motiv`, `hoehe`, `breite`) |
| `BannerGalerie.html` | alle 76 Motive zum Nachschlagen |
| `Bloom.html` | Blume |
| `banners.json` | **die Banner-Daten** (76 Motive) |
| `banner-render.js` | Referenz-Renderer |

## 1. Warum die Karte vorher leer wirkte

Der Banner war eine kleine Szene (350 × 110) in einer deutlich größeren Fläche. Jetzt wird die Szene **auf die Fläche skaliert** (Abschnitt 3), und der Karteninhalt hat feste Höhen, die die Karte komplett füllen.

## 2. Karte (V2 Kacheln)

Karte 350 × 518 (wie bei euch), Radius 28, Hintergrund `--text` #E7EEDF, `overflow: hidden`.

| Bereich | Spezifikation |
|---|---|
| **Banner** | 350 × **170**, oben bündig. Pille links oben: Kategorie (weiß 90 %, DM Mono 11, 26 hoch). Pille rechts oben: „Nº n / N" (rgba(17,26,20,.55), Text `--text`). Je 14 px vom Rand. |
| **Inhalt** | Höhe 348, Padding 18 / 20 / 18, Flex-Spalte |
| Titel | 28 px/800, line-height 1.04, letter-spacing −0.03em, **max. 2 Zeilen** (line-clamp) |
| Beschreibung | 8 px darunter, 15 px, line-height 1.4, #4A5547, **max. 2 Zeilen** |
| **3 Kacheln** | Abstand 16 nach oben, Grid 3 Spalten, Gap 8, jede **92 hoch**, Radius 18, Padding 10/12. Oben Label (DM Mono 10, opacity .7) + 24-px-Kreis (weiß 70 %) mit Icon (⌖ ◷ €), unten Wert 16/800, max. 2 Zeilen. Farben: **WO** #DCEBD9 / Text #163A22 · **DAUER** #F7EBC4 / #3A2E10 · **KOSTEN** #DCE7F5 / #16283E |
| **Datumsstreifen** | `margin-top: auto` (klebt unten), 58 hoch, Radius 20, Hintergrund #163A22, Padding links 18 / rechts 12. Links Datum 22/800 + Uhrzeit DM Mono 12 #C9D4C4. Rechts Pille 32 hoch #2E7D46, weiß, „✓ beide frei". |

- **Ohne festen Termin:** nächster gemeinsamer freier Abend im Datumsstreifen, wie in `SWIPE-KARTE.md` Abschnitt 2.3. Gibt es keinen gemeinsamen freien Slot, wird die Pille zu „kein Slot frei" (Hintergrund #8A6440).
- **Lange Texte:** nie die Kartenhöhe ändern, immer kürzen (line-clamp). Werte in den Kacheln max. 2 Zeilen.
- Blume und Sprechblase unter der Karte bleiben unverändert.

## 3. Banner

### Daten
`banners.json` – pro Motiv:

```ts
type Banner = {
  name: string;           // Anzeigename
  bg: string;             // Pastell: #F6DFD3 | #DCEBD9 | #F7EBC4 | #DCE7F5 | #E6E0F2
  shapes: {               // der Reihe nach von hinten nach vorn gezeichnet
    l: number; t: number; w: number; h: number;   // px auf der 350×110-Bühne
    c: string;            // Farbe (rgba erlaubt)
    r: string;            // border-radius, z. B. '50%'
    rot: number;          // Grad
    op: number;           // Deckkraft
    clip: string;         // clip-path oder 'none'
  }[];
};
```

Jedes Motiv besteht nur aus absolut positionierten Formen, **kein SVG, kein Bild**. Gleiche Daten lassen sich später auch als Bild exportieren (Playwright) oder in SVG umrechnen, falls ihr das braucht.

### Skalierung (wichtig)
- Bühne ist immer 350 × 110.
- `scale = max(zielHöhe / 110, zielBreite / 350)`
- Bühne **unten mittig** verankern (`left: 50%`, `margin-left: -175px`, `transform-origin: 50% 100%`), Container `overflow: hidden`.
- Dadurch füllt jedes Motiv jede Fläche (Karte 350 × 170, Vollbild 366 × 150, Archiv-Kacheln usw.), seitlich wird bei schmalen Flächen etwas abgeschnitten, oben bleibt immer Himmel.
- Deshalb liegt jede Szene am unteren Rand und hat links/rechts etwas Luft.
- Referenz: `banner-render.js`.

### Die 76 Motive (Schlüssel)
- **Essen & Trinken:** crepes, pizza, burger, sushi, eis, kaffee, cocktail, wein, kochen, picknick, grill, biergarten, brunch, streetfood, dinner
- **Musik & Kultur:** karaoke, konzert, stadion, kino, theater, museum, lesen, tanzen, plattenladen, zirkus, filmabend
- **Draußen & unterwegs:** sonnenuntergang, wandern, fahrrad, park, see, stadt, sterne, strand, camping, markt, winter, roadtrip, reise, burg, kajak, botanik, blumen, planetarium, flaschenpost
- **Tiere & Freizeit:** tiere, zoo, aquarium, hund, freizeitpark, arcade, wasserpark
- **Sport & aktiv:** tischtennis, bouldern, schwimmen, minigolf, eislaufen, bowling, fussball, rodeln, yoga
- **Kreativ:** malen, toepfern, basteln, foto
- **Zuhause & Ruhe:** spiele, wellness, badewanne, gaertnern, shoppen, quiz
- **Rätsel & Besonderes:** schnitzeljagd, escape, ueberraschung, herz, sprosse

(Die Einteilung steht nur hier und in der Galerie, im Code reicht eine flache Map.)

### Zuordnung Idee → Motiv
- Jede Idee bekommt ein Feld `motiv: string` (Schlüssel aus `banners.json`). Das ersetzt die frühere `illustration`/`farbe` aus `SWIPE-KARTE.md`; **die Farbe kommt jetzt aus `banners[motiv].bg`**.
- **Fallback:** unbekannter oder fehlender Schlüssel → `herz`.
- Die Zuordnung für die vorhandenen Ideen macht ihr einmalig per Skript/Map. Bitte schlag sie vor und lass mich drüberschauen, nicht blind raten.
- Beim Anlegen eigener Ideen: Motiv-Auswahl als horizontal scrollende Reihe kleiner Banner (je 88 × 28) im Idee-Editor, Standard = passendes Motiv zur Kategorie.

## 4. Vollbild

Öffnet sich per Tippen auf die Karte. Karte füllt fast den Bildschirm: `left/right 12, top 62, height 700`, Radius 28, **ohne Navigationsleiste sichtbar darunter** (die Leiste bleibt, die Karte liegt darüber/darin wie im Mockup).

| Bereich | Spezifikation |
|---|---|
| Banner | 366 × 150 (`breite=366`), Kategorie-Pille links oben, runder ✕-Button 36 px rechts oben (rgba(17,26,20,.6)) |
| Inhalt | scrollt bei Bedarf, Padding 18 / 20 |
| Zeile 1 | Datum 36/800 links · „Nº n / N" DM Mono 11 rechts |
| Zeile 2 | Uhrzeit + „✓ ihr habt beide Zeit", 15/700, grün #2E7D46 |
| Titel / Text | Titel 28/800 (max. 2 Zeilen), Beschreibung 15 px (**hier max. 3 Zeilen**, antippen klappt komplett auf) |
| Chips | ⌖ wo · ◷ dauer · € kosten (weiß, 32 hoch) |
| **Karte** | 16 px darunter, 124 hoch, Radius 18, hier die echte Google-Maps-Einbindung (Static Map oder Embed). Im Mockup nur gezeichneter Platzhalter + Ortspille. Bei Ideen ohne Ort entfällt der ganze Block samt Button. |
| Button | „In Google Maps öffnen", Outline 2 px, 46 hoch, Pille |
| **Untere Leiste (neu)** | fest am Kartenrand, 82 hoch, Verlauf von transparent nach #E7EEDF. Links „Kompost" (Outline #8A6440, flex 1), rechts „Einpflanzen" (gefüllt #2E7D46, flex 1.5). Nimmt die Entscheidung aus dem Vollbild ab, ohne erst zurückzuwischen. |

Ohne die untere Leiste bleibt unten wieder Leerraum, deshalb gehört sie dazu. Wenn ihr die Aktionen anders löst, den Platz anders füllen (z. B. größere Karte), aber nicht leer lassen.

## 5. Barrierefreiheit & Verhalten
- Wischen bleibt die Hauptgeste. Kompost/Einpflanzen weiter als unsichtbare Buttons mit `aria-label` auf der Karte; im Vollbild sind es sichtbare Buttons.
- Banner sind dekorativ: `aria-hidden="true"`, Titel ist die Information.
- Kontrast: Text auf Pastellflächen ist dunkel (#1B2620 / #163A22), mindestens 4.5 : 1.
- `prefers-reduced-motion`: Karten-Flug und Blumen-Animation abschalten.
