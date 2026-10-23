# Date-O-Mat – Ideen: Kategorie-Ansicht („kurz“, „lang“, „draußen“ …)

Ergänzt `DESIGN-GARTEN.md` (Ideen = Saatgut-Regal). Die Übersicht mit den Kacheln bleibt unverändert. Neu ist die Ansicht, die nach dem Tippen auf eine Kachel erscheint.

Referenz: `screens/IdeenKat.html` mit `variante="e"`. Das ist Variante A (Liste) plus die Tipp-Karte aus C. Die `{{ }}`-Werte werden im Script (`renderVals`) berechnet. Farben und Schriften wie in DESIGN-GARTEN.md, Maße für 390 × 844.

**Gilt für alle Kategorien gleich.** Nur Titel, Untertitel, Spruch und die Ideen ändern sich.

## 1. Aufbau

| Bereich | Spezifikation |
|---|---|
| Kopf (top 16) | Zurück-Button 40 px rund `--surface` „←“ + DM Mono 11 `--muted` „ideen / regal“. Zurück-Geste geht ebenfalls zur Übersicht. |
| Titel (top 66) | Kategoriename klein + Punkt, z. B. „kurz.“, 54 px/800, letter-spacing −0.05em |
| Untertitel (top 126) | 14 px `--muted`: Kachel-Untertitel + Anzahl, z. B. „keimt an einem Abend · 39 Ideen“ |
| Blume (left 296, top 44) | Bloom scale 0.26, Stimmung `froh`, Hintergrund transparent |
| Sprechblase | left 156, top 72, Breite 134. Hintergrund `--text`, Schrift #1B2620, Caveat 600 17 px, Radius 18, −2°. Zwei Punkte vom Mund aus: 6 px bei (308, 79), 10 px bei (293, 86). Sie darf Titel und Untertitel nicht verdecken. |
| Filter-Chips (top 160) | Horizontal scrollbar, Höhe 36, Abstand 8. Inaktiv: Rand 1.5 px #3A4A40, transparent. Aktiv: `--cta` gefüllt, Text #111A14. Rechts im Chip die Anzahl in DM Mono 11 (opacity .7). Set: **alle · gratis · ≤ 1,5 Std · drinnen · draußen** (sinnvoll je Kategorie, leere Chips ausblenden). `aria-pressed` setzen. |
| Tipp-Karte (top 208, h 164) | Siehe Abschnitt 2 |
| Liste (ab top 380) | Siehe Abschnitt 3, scrollt bis über die Navigation (66 px) |

## 2. Tipp der Blume (oben)

Helle Karte `--text` (#E7EEDF), Text #1B2620, Radius 24, Innenabstand 12.

- **Zeile 1:** links das Illustrations-Kärtchen 60 × 60, Radius 16, Pastellfarbe der Idee. Rechts davon:
  - DM Mono 10 „TIPP DER BLUME“
  - Titel 18/800 (einzeilig, Ellipse)
  - Grün `--green` 13/700: **nächster gemeinsamer freier Abend**, z. B. „Fr 30.10. · ab 19:30 · ✓ beide frei“
  - DM Mono 10: „1 STD · GRATIS · RHEINAUHAFEN“
- **Zeile 2:**
  - „Ins Beet pflanzen“: gefüllt `--green`, weiß, 44 px. Startet die Planung mit dieser Idee und dem genannten Abend.
  - „anderer ↻“: Outline 2 px #C9D4C4. Zeigt den nächsten Tipp.

**Auswahl des Tipps:**

1. Grundlage sind die Ideen, die zum aktiven Filter passen.
2. Bevorzugt werden Ideen, die in den nächsten 7 Tagen in einen gemeinsamen freien Slot passen. Die Dauer der Idee muss reinpassen, Uhrzeiten und Wetter fließen ein, wenn vorhanden.
3. Innerhalb davon zuerst Ideen, die der/die andere geliked hat. Danach die, die am längsten nicht vorgeschlagen wurden.
4. „anderer“ geht reihum durch diese Liste.
5. Gibt es keinen passenden Slot: Tipp trotzdem zeigen. Statt der grünen Zeile dann `--muted` „gerade kein gemeinsamer Abend frei“.
6. Die Tipp-Idee taucht in der Liste darunter **nicht** nochmal auf.

## 3. Liste („Saatreihen“)

Die Liste ist in zwei Gruppen geteilt. Jede Gruppe hat einen Kopf in DM Mono 11, links der Titel, rechts die Anzahl in `--muted-2`:

- **„✓ PASST DIESE WOCHE“** (#6DBA74): Ideen mit freiem gemeinsamem Slot in den nächsten 7 Tagen
- **„IRGENDWANN“** (`--muted`): der Rest

Eine Gruppe ohne Einträge wird ausgeblendet.

Zeile: Höhe 72, Radius 20, `--surface`, Innenabstand 8/10/8/8, Abstand 8. Inhalt von links nach rechts:

1. **Illustrations-Kärtchen** 56 × 56, Radius 15, Pastellfarbe der Idee, Illustration 40 × 40 zentriert.
2. **Titel** 16/700, einzeilig mit Ellipse. Darunter **Meta** DM Mono 11 `--muted`, in Großbuchstaben: „DAUER · PREIS · ORT“.
3. **Like-Badge** (nur wenn geliked): Pille 22 px mit „L ♥“ (#4D63E8) oder „J ♥“ (#E58FA6), weiß. `aria-label` „Lotte mag das“ bzw. „Jonas mag das“. Liken beide, ist es ein Match. Dann gehört die Idee zu den Keimlingen, hier trotzdem anzeigen mit beiden Badges.
4. **Pfeil** 36 px rund #26332B „›“.

Tippen auf eine Zeile öffnet die Idee. Dafür die bestehende Detailansicht nehmen, oder die Swipe-Karte C2 als Detailansicht.

**Leerer Zustand** (Filter ohne Treffer): Blume `traurig`, Spruch „hier wächst grad nix. anderer filter?“ und Button „Filter zurücksetzen“.

## 4. Daten

Pro Idee wird gebraucht (siehe auch `SWIPE-KARTE.md`, Felder `farbe`, `illustration`, `sprueche`):

```ts
type Idee = {
  // … bestehende Felder (titel, kategorie, dauerMin, preis, ort, …)
  farbe: string;            // Pastell, eins von #F6DFD3 #DCEBD9 #F7EBC4 #DCE7F5 #E6E0F2
  illustration: string;     // Schlüssel der Illustrations-Bibliothek
  wo: 'drinnen' | 'draussen' | 'egal';
  likes: { jonas: boolean; lotte: boolean };
};
```

„Passt diese Woche“ und der Tipp nutzen die vorhandene Slot-Logik aus den Google-Kalendern. Ergebnis pro Idee: der früheste passende Slot oder `null`. Das einmal beim Öffnen berechnen und cachen.

## 5. Sprüche der Blume (Kopf)

Pro Kategorie ein kleiner Pool, z. B.:

- **kurz:** „kurz & gut. so wie ich.“ · „mein tipp liegt ganz oben.“ · „ein abend reicht für was schönes.“
- **lang:** „pack snacks ein. und mich.“
- **draußen:** „sonne! endlich mal licht.“
- **drinnen:** „fensterbank-wetter. ich bin dabei.“
- **mit ort:** „kenn ich. war ich aber nie.“
- **eigene:** „selbst gesät? stolz auf euch.“

Antippen der Blume zeigt einen neuen Spruch.
