# Date-O-Mat – Swipe-Karte „C2“ (mit Bildstreifen)

Ergänzt `DESIGN-GARTEN.md` (Abschnitt 5.2) und **ersetzt** dort die Samentüte und die ✕/♥-Buttons.
Referenz: `screens/SwipeC.html` (Variante 2, `variante="2"` im Script). Farben/Schriften wie in DESIGN-GARTEN.md.

## 1. Seite

| Bereich | Spezifikation |
|---|---|
| Kopfzeile | Logo links · rechts Pille „🌱 n Matchlinge“ (`--surface`, Sprossen-Icon `--leaf-b`) |
| Titel (top 62) | „swipen.“ 40 px/800 · darunter DM Mono 11 `--muted` „Lotte hat n geswiped“ · rechts runder Filter-Button 44 px `--surface` |
| Kartenstapel (top 124) | Karte 350 × 512, Radius 28, Hintergrund `--text` (#E7EEDF), Schatten `0 18px 30px rgba(0,0,0,.4)`. Dahinter nächste Karte als Fläche #2A3830, 326 × 512, +3° gedreht |
| Blume (left 4, top 646) | Bloom-Komponente, scale 0.3 (92 × 129). **Antippen = neuer Spruch** |
| Sprechblase (left 92, top 654) | max. 250 px, `--butter`, Text #2B1D12, Caveat 600 20 px, Radius 18/18/18/4 (Zipfel unten links), −2° |
| Hinweis (top 724) | DM Mono 10 `--muted-2`: „← kompost · wischen · einpflanzen →“ (nach den ersten ~5 Swipes ausblenden) |
| Status (top 746) | DM Mono 11: „n geswipt · n übrig“ · rechts „↺ zurück“ |
| **Keine ✕/♥-Buttons.** Bedienung nur per Wischen (plus Tastatur/Screenreader: die zwei Aktionen als unsichtbare Buttons mit aria-label behalten) |

## 2. Karte

1. **Bildstreifen** oben, 110 px hoch, volle Breite, Hintergrund = Pastellfarbe der Idee, darauf eine **zur Idee passende, einfache Illustration** aus Formen (im Mockup: Crêpes-Stapel + Mikrofon in Rosa).
2. Innen 20 px Abstand, 14 px zwischen den Blöcken:
   - Zeile: Chip „Sorte: Gemütlich“ (weiß, DM Mono 11) · rechts „Nº 5 / 74“ (DM Mono 11 #6A7566)
   - **Datum** „Sa 31.10.“ 42 px/800, letter-spacing −0.055em
   - Grün `#2E7D46` 17 px/700: „20:00 Uhr · ✓ ihr habt beide Zeit“
   - Trennlinie 1,5 px #C9D4C4, dann **Titel** 24 px/800 (max. 2 Zeilen). Keine Beschreibung in dieser Variante.
   - Unten (margin-top auto): weiße Info-Box, Radius 18, 3 Zeilen mit 28-px-Icon-Kachel, Wert 15/700 + Zusatz 12 px, Label rechts DM Mono 10: **WO** · **DAUER** · **KOSTEN**
3. **Ohne festen Termin:** Statt des Event-Datums den **nächsten gemeinsamen freien Abend** zeigen („Fr 23.10.“ + „ab 18:00 · ✓ ihr habt beide Zeit“). Die Karte bleibt immer gleich aufgebaut.

## 3. Wischen

- Karte folgt dem Finger, dreht sich bis ±9° um die Unterkante.
- Ab ~30 % Weg erscheint ein Stempel oben links (rechts wischen) bzw. oben rechts (links wischen): 4 px Rand, Radius 12, 28 px/800, −14° bzw. +14°. Rechts: **EINPFLANZEN** in `--green` (#2E7D46). Links: **KOMPOST** in #8A6440.
- Loslassen über Schwelle → Karte fliegt raus, nächste rückt nach. Sonst zurückfedern.
- Blume reagiert: rechts → `froh` + Spruch, links → kurz `traurig` + Spruch, danach wieder `wartet`.
- Match → Overlay „keimt!“ (siehe DESIGN-GARTEN.md 5.2).

## 4. Pro Idee: Illustration + Sprüche

Jede Idee braucht zusätzlich (Datenmodell erweitern):

```ts
type Idee = {
  // … bestehende Felder
  farbe: string;          // Pastell für den Bildstreifen, z. B. '#F6DFD3'
  illustration: string;   // Schlüssel einer Illustration, z. B. 'crepes-musik'
  sprueche: {
    neutral: string[];    // beim Anzeigen / Antippen der Blume
    like: string[];       // nach Rechts-Wischen
    nope: string[];       // nach Links-Wischen
  };
};
```

- **Illustrationen:** eine Bibliothek aus einfachen SVG-/CSS-Illustrationen im Stil des Mockups (weiche Formen, 2–4 Farben, keine Outlines). Startset nach Kategorie, z. B. essen, musik, draußen, wasser, kultur, kreativ, sport, abends, wellness. Eine Idee kann zwei kombinieren (Crêpes + Mikro).
- **Farben** nur aus den Kachel-Pastellen: #F6DFD3, #DCEBD9, #F7EBC4, #DCE7F5, #E6E0F2.
- **Sprüche:** kurz (max. ~45 Zeichen), klein geschrieben, frech, und sie beziehen sich auf **Details der Idee** (Ort, Kosten, Uhrzeit, Aktivität), nicht allgemein. Beispiele für Crêpes + ABBA:
  - neutral: „crêpes UND abba? ich wär dabei.“ · „ich würd mitsingen – hab nur keine lunge.“ · „40 € sind 8 säcke blumenerde. nur so.“
  - like: „jaaa! ab ins beet damit!“ · „dancing queen, young and … gegossen!“
  - nope: „kompost? die crêpes weinen jetzt.“
- Sprüche können beim Anlegen der Idee per KI erzeugt und gespeichert werden (nicht bei jedem Anzeigen neu). Fallback: allgemeine Sprüche je Kategorie.
