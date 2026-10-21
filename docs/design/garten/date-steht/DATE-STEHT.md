# Date-O-Mat – „date steht." · Karte hochziehen

Ergänzt `DESIGN-GARTEN.md`. Referenz: `screens/Steht.html` (Props `tempo` = sanft|schubs, `zustand` = zu|mitte|offen) und `screens/Bloom.html` (neue Stimmungen `genervt` und `autsch`). Farben und Schriften wie in DESIGN-GARTEN.md. Alle Maße gelten für 390 × 844.

Der Button „Details“ fällt weg. Die Event-Karte selbst ist das Bedienelement.

## 1. Aufbau (geschlossen)

| Element | Position / Stil |
|---|---|
| Kopfzeile | top 18 · Logo links · J/L-Avatare rechts (32 px, überlappend) |
| Headline | „date<br>steht." left 20, top 66, 70 px/800, line-height 0.9 |
| Wochenleiste | top 198 |
| Untertitel | top 240, 15 px `--muted`: „Lotte hat zugesagt. Ihr seht euch Freitag.“ |
| Blume | Bloom, scale 0.72, Wrapper left 82 / top 263 (216 × 302), `transform-origin: top left`, über der Karte (z-index 3) |
| Karte | left/right 12, Radius 26, `--surface`, Schatten `0 -10px 30px rgba(0,0,0,.35)`, Griff 38 × 4 oben mittig |
| Karteninhalt | Titel 21/800 · Meta 15 `--muted` · Chip „✓ in beiden Kalendern“ · darunter die Details mit opacity 0.35 als „Vorschau“ (abgeschnitten) |

**Die Unterkante der Karte ist in jedem Zustand gleich: y = 764** (kurz über der Navigation). Es ändert sich nur `top`:

| Zustand | top | Höhe |
|---|---|---|
| zu | 572 | 192 |
| offen | 236 | 528 |

## 2. Aufgeklappt (Details)

Die Details faden mit 250 ms Verzögerung auf opacity 1 ein (translateY 16 → 0):

- Karte bzw. Kartenvorschau, 128 px hoch, Radius 18, mit Pin in `--like`
- Zeilen in DM Mono 11: TREFFPUNKT · MITNEHMEN · VON LOTTE (Wert in Caveat 19 `--butter`)
- Buttons „Route“ (gefüllt `--cta`) und „Verschieben“ (Outline), darunter Link „Absagen“

Untertitel und Wochenleiste blenden aus (opacity 0, 300 ms), sobald die Karte sich bewegt.

## 3. Geste

- **Tippen** auf die geschlossene Karte → öffnet sie (wie sanft).
- **Hochziehen:** Die Karte folgt dem Finger (`top` = Finger). Die Blume wird dabei anteilig mitgeschoben: Position, Skalierung und Rotation werden zwischen „zu“ und „offen“ interpoliert, abhängig vom Fortschritt p = (572 − top) / 336.
- **Loslassen:**
  - Geschwindigkeit nach oben **> 0,8 px/ms → schubs**
  - sonst **sanft**
  - p > 0,35 → öffnen, sonst zurück auf „zu“
- **Schließen:** Runterziehen am Griff/Kopf der Karte (gleiche Logik umgekehrt), Tippen auf den Griff, oder Zurück-Geste.
- Pointer Events mit `touch-action: none` auf dem Griffbereich. Innerhalb der offenen Karte normales Scrollen; erst bei scrollTop 0 und Zug nach unten schließt die Karte.
- `prefers-reduced-motion`: keine Überschwinger und keine Rotation, nur Fade/Slide in 200 ms.
- Barrierefreiheit: Karte als Button mit `aria-expanded`, Label „Details öffnen“ / „Details schließen“.

## 4. Blume – Endpositionen

Transform auf den Wrapper (Ursprung oben links):

| Zustand | transform | Stimmung |
|---|---|---|
| zu | `none` | froh |
| mitte · sanft | `translate(60px,-60px) scale(.8) rotate(8deg)` | genervt |
| mitte · schubs | `translate(120px,-150px) scale(.62) rotate(-38deg)` | autsch |
| offen · sanft | `translate(180px,-211px) scale(.444)` | genervt |
| offen · schubs | `translate(173px,-198px) scale(.444) rotate(-14deg)` | autsch |

**Offen sitzt der Blütenkopf bei etwa (310, 88)**, im freien Feld rechts neben der Headline und unter den Avataren.

Timing:

- **Sanft:** 900 ms `cubic-bezier(.4,0,.2,1)`, die Blume wird hochgedrängt.
- **Schubs:** 650 ms `cubic-bezier(.2,1.7,.4,1)` (Überschwinger). Die Blume wird weggekickt, dazu kurz 3 Bewegungslinien (`--butter`, 3 px, −40°, opacity .7), die nach ~400 ms ausblenden.

Beim Schließen läuft die Blume zurück auf „zu“ und wird wieder `froh`.

### Neue Bloom-Stimmungen

- **genervt:** flache Augen, eine Braue hochgezogen, flacher Mund, Kopf +8°.
- **autsch:** Kreuzaugen (je zwei gekreuzte Balken), offener dunkler Mund, Kopf −18°, Sternchen um den Kopf, 2 der 8 Blütenblätter fehlen (Index 1 und 4).

Werte siehe `Bloom.html` (`P.genervt`, `P.autsch`, `eyesX`, `eyesFlat`, `mouthOuch`).

## 5. Sprechblase

Die Blase geht **immer vom Mund aus**: erst ein kleiner Punkt (6 px), dann ein größerer (10 px), dann die Blase.

- Farbe `--text` (#E7EEDF), Schrift #1B2620, Caveat 600, Radius 20, leicht gedreht (±2–5°).
- Die Blase **darf nie Inhalt verdecken**: nicht Headline, Untertitel, Karte, Logo oder Avatare.
- Punkte und Blase wandern mit derselben Dauer wie die Blume.

| Zustand | Punkt klein (6) | Punkt groß (10) | Blase (left, top, Breite) | Text |
|---|---|---|---|---|
| zu | 243, 340 | 254, 326 | 266, 268, 110 · 20 px | „juhu, wasser! freitag wird schön.“ |
| mitte · sanft | 172, 292 | 156, 302 | 22, 292, 128 · 19 px | „hey … ich rück ja schon.“ |
| mitte · schubs | 276, 150 | 266, 170 | 200, 196, 104 · 24 px | „WAAAH—!“ |
| offen · sanft | 280, 78 | 267, 62 | 112, 8, 150 · 17 px | „na gut. ich wart hier oben.“ |
| offen · schubs | 280, 78 | 267, 62 | 112, 8, 150 · 17 px | „AUA! mein lieblingsblatt.“ |

Offen steht die Blase oben zwischen Logo und Avataren.

In der App die Punkte am besten **berechnen statt hart codieren**:

1. Mundposition aus dem Blumen-Transform bestimmen (Mund im Bloom bei (150, 122) × 0.72 × Transform).
2. Den kleinen Punkt knapp außerhalb der Blütenblätter in Richtung Blase setzen.
3. Den großen Punkt auf halbem Weg zur nächstgelegenen Blasenecke setzen.

Sprüche als Pools pro Zustand (zufällig ziehen), z. B.:

- **sanft:** „hey … ich rück ja schon.“ · „drängeln ist auch eine sprache.“ · „na gut. ich wart hier oben.“ · „ich hab hier oben eh die bessere aussicht.“
- **schubs:** „WAAAH—!“ · „AUA! mein lieblingsblatt.“ · „ich bin eine PFLANZE, kein ball!“ · „das sag ich lotte.“
- **zu:** spruch passend zum Date wie auf der Startseite.
