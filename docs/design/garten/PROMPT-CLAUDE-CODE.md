Ich will die App auf das neue Design „Garten“ umbauen. Die komplette Spezifikation liegt in
docs/design/garten/DESIGN-GARTEN.md. Lies sie zuerst vollständig, sie ist die Quelle der Wahrheit.

Referenzdateien:
- docs/design/garten/screens/HomeB.html      → Beet (Startseite)
- docs/design/garten/screens/ThSwipe.html    → Swipen (Samentütchen)
- docs/design/garten/screens/ThIdeen.html    → Ideen (Saatgut-Regal)
- docs/design/garten/screens/ThArchiv.html   → Archiv (Stiel mit Foto-Blättern)
- docs/design/garten/screens/ThSetup.html    → Setup (Gartenschuppen)
- docs/design/garten/components/Bloom.html   → die Blume (Logik im <script> → renderVals)
- docs/design/garten/components/BloomStates.html → Soll-Bild aller 5 Stimmungen

Die HTML-Dateien kommen aus einem Design-Tool und laufen nicht eigenständig. Nimm sie als
pixelgenaue Referenz: Alle Maße, Farben und Abstände stehen als Inline-Styles im Markup (390 × 844,
absolut positioniert). {{ … }} sind Werte, die renderVals() im <script> berechnet; <sc-for> ist
eine Schleife, <sc-if> eine Bedingung, <dc-import name="Bloom" …> die Blumen-Komponente mit Props.

Rahmenbedingungen:
- Die ganze App ist dunkel (Tokens aus Abschnitt 2). Die älteren hellen Pastell-Farben aus früheren
  Design-Dokumenten gelten nicht mehr.
- Bestehende Funktionen und Daten bleiben erhalten. Es ist ein visueller Umbau plus die
  Garten-Begriffe; keine Logik löschen, ohne mich zu fragen.
- Barrierefreiheit: echte <button>/<a>, aria-labels an Icon-Buttons, Kontrast mind. 4.5:1.

Vorgehen:
1. Analyse (noch keinen Code ändern): Schau dir die aktuelle App an (Stack, Routing, bestehende
   Komponenten für Main Page, Pflanze/Topf, Swipe, Ideen, Archiv, Setup, Tab-Leiste) und gib mir
   einen kurzen Plan: was du ersetzt, was neu dazukommt, welche Daten fehlen
   (z. B. Blumenname, freigeschaltete Töpfe, „nochmal machen?“-Bewertung). Warte auf mein OK.
2. Tokens + Schriften: Lege die Design-Tokens aus Abschnitt 2 zentral an (CSS-Variablen bzw. Theme)
   und binde Bricolage Grotesque, DM Mono und Caveat ein.
3. Gemeinsame Bausteine (Abschnitt 3): Kopfzeile, Avatar mit Personen-Ring, Tab-Leiste mit
   erhöhtem Swipe-Button und Badge, Buttons, Karten, Segment-Schalter, Sprechblase der Blume.
4. Die Blume (Abschnitt 4) als eigene Komponente mit Props stimmung, blaetter, welk, grund.
   Übernimm die Geometrie aus Bloom.html (renderVals). Der Topf hat kein Gesicht.
   Baue eine Funktion, die die Stimmung aus Rundenstatus und Restzeit ableitet (Pseudocode in 4).
   Baue eine Dev-Route (z. B. /dev/blume), die alle 5 Stimmungen nebeneinander zeigt, damit ich sie
   mit BloomStates.html vergleichen kann.
5. Seiten in dieser Reihenfolge, jeweils nach Abschnitt 5 und der Referenzdatei:
   5.1 Beet → 5.2 Swipen (inkl. Match-Overlay „keimt!“) → 5.3 Ideen → 5.4 Archiv (Stiel-Ansicht
   + Umschalter zur bisherigen Raster-Ansicht) → 5.5 Setup (Hinweis-Banner nur wenn etwas fehlt,
   Blumenname, Topf-Auswahl).
   Nach jeder Seite: kurz zusammenfassen, was geändert wurde, und auf mein OK warten.
6. Zum Schluss: Prüfe alle Seiten auf 390 px Breite und auf einem kleinen Gerät (360 × 640),
   dass nichts überlappt (Blume, Sprechblase, Tab-Leiste) und Texte nicht abgeschnitten werden.

Nicht Teil dieses Umbaus: die Animationen aus Abschnitt 6.
