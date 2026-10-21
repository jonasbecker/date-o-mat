Bau in Date-O-Mat die Seite „date steht." um: Die Event-Karte wird zum Bottom Sheet, das man antippen oder hochziehen kann. Die Blume wird dabei je nach Wischtempo sanft hochgedrängt oder weggeschubst.

Im Ordner `date-steht/` liegen:
- `DATE-STEHT.md` – die vollständige Spezifikation (Maße, Zustände, Geste, Timing, Sprechblasen)
- `screens/Steht.html` – Pixel-Referenz. Die `{{ }}`-Werte werden im Script unten (`renderVals`) pro Zustand berechnet; die Zustände sind zu, mitte, offen × sanft, schubs.
- `screens/Steht*.html` – Wrapper für die Zwischenzustände
- `screens/Bloom.html` – Blumen-Komponente mit den neuen Stimmungen `genervt` und `autsch`

Vorgehen:
1. Lies DATE-STEHT.md und die Referenzen. Schau dir an, wie die Seite „date steht" und die Blumen-Komponente bei uns aktuell gebaut sind. Schreib mir dann einen kurzen Plan (betroffene Dateien, wie du die Geste umsetzt, welche Library du ggf. nutzt) und **warte auf mein OK**.
2. Erweitere die Blumen-Komponente um `genervt` und `autsch`. Die bestehenden Stimmungen dürfen sich dabei nicht ändern. Häng beide an die Dev-Route mit den Blumen-Stimmungen an, damit ich vergleichen kann.
3. Entferne den Button „Details“. Bau die Karte als Sheet:
   - Die Unterkante liegt immer bei y 764 (über der Navigation); nur `top` ändert sich.
   - Tippen öffnet die Karte.
   - Beim Ziehen folgt die Karte dem Finger und die Blume wird anteilig interpoliert.
   - Beim Loslassen: Geschwindigkeit > 0,8 px/ms → „schubs“, sonst „sanft“. Ab 35 % Weg öffnen, sonst zurückfedern.
   - Schließen per Runterziehen oder Tippen auf den Griff.
   - Halte dich an `prefers-reduced-motion` und setze `aria-expanded`.
4. Blume:
   - Endpositionen, Stimmungen und Easings genau wie in der Tabelle (Abschnitt 4). Offen sitzt sie oben rechts neben der Headline.
   - Bei schubs: Überschwinger und Bewegungslinien.
5. Sprechblase:
   - Immer vom Mund aus: kleiner Punkt → größerer Punkt → Blase.
   - Sie darf nie Headline, Untertitel, Karte, Logo oder Avatare verdecken; Positionen siehe Abschnitt 5.
   - Rechne die Punkte am besten aus der Mundposition.
   - Sprüche aus Pools je Zustand.
6. Untertitel und Wochenleiste blenden aus, sobald die Karte sich bewegt.
7. Test:
   - Auf 390 × 844 und auf einem kleineren Viewport (360 × 740) prüfen, dass nichts überlappt.
   - Langsam und schnell wischen, öffnen und schließen.
   - Mach Screenshots der Zustände zu, offen sanft und offen schubs und vergleich sie mit den Referenzen.
8. Zeig mir am Ende, was du geändert hast und wo du von der Referenz abweichen musstest.
