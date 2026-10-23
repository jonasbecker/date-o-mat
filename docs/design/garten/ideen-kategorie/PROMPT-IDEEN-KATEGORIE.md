Bau in Date-O-Mat die Kategorie-Ansicht der Ideen neu. Gemeint ist die Seite, die nach dem Tippen auf eine Kachel wie „kurz“ erscheint. Die Übersicht mit den Kacheln bleibt, wie sie ist.

Im Ordner `ideen-kategorie/` liegen:
- `IDEEN-KATEGORIE.md` – die vollständige Spezifikation (Aufbau, Tipp-Karte, Liste, Daten, Sprüche)
- `screens/IdeenKat.html` – Pixel-Referenz. Die gewählte Variante ist `variante="e"`: Liste plus „Tipp der Blume“ oben. Die `{{ }}`-Werte werden im Script unten (`renderVals`) berechnet; dort stehen auch die Beispiel-Illustrationen als Formen-Listen.
- `screens/IdeenKatE.html` – Wrapper mit der gewählten Variante
- `screens/ThIdeen.html` – die bestehende Übersicht, nur zur Einordnung
- `screens/Bloom.html` – Blumen-Komponente

Vorgehen:
1. Lies IDEEN-KATEGORIE.md und die Referenzen. Schau dir an, wie die Kategorie-Ansicht und die Ideen-Daten bei uns aktuell gebaut sind. Schreib mir dann einen kurzen Plan (Dateien, nötige Datenfelder bzw. Migration, wie du „passt diese Woche“ aus der vorhandenen Slot-Logik ableitest) und **warte auf mein OK**.
2. Baue die Ansicht als **eine** Komponente für alle Kategorien. Titel, Untertitel und Sprüche kommen aus einer Konfiguration pro Kategorie.
3. Kopf: Zurück, großer Titel, Blume mit Sprechblase. Die Blase geht vom Mund aus (kleiner Punkt, großer Punkt) und darf nichts verdecken.
4. Filter-Chips mit Anzahl. Chips ohne Treffer ausblenden. Der aktive Filter wirkt auf Tipp und Liste.
5. Tipp der Blume:
   - Auswahl genau wie in Abschnitt 2.
   - „Ins Beet pflanzen“ startet die Planung mit Idee und Slot.
   - „anderer ↻“ geht reihum.
   - Die Tipp-Idee kommt nicht nochmal in der Liste vor.
6. Liste:
   - Gruppen „✓ passt diese Woche“ und „irgendwann“.
   - Zeilen mit Illustrations-Kärtchen, Meta-Zeile und Like-Badges.
   - Tippen öffnet die Idee.
   - Leerer Zustand wie beschrieben.
7. Illustrationen:
   - Leg eine kleine Bibliothek an (einfache Formen, 2–4 Farben, wie in der Referenz).
   - Für Ideen ohne Illustration gibt es einen Fallback je Kategorie.
   - Wenn es die Bibliothek vom Swipe-Karten-Umbau schon gibt, nutze sie.
8. Test:
   - Auf 390 × 844 und 360 × 740 prüfen: keine Überlappung, Titel mit Ellipse, Liste scrollt sauber unter die Navigation.
   - Jede Kategorie einmal öffnen, jeden Filter einmal antippen.
   - Mach Screenshots und vergleich sie mit der Referenz.
9. Zeig mir am Ende, was du geändert hast und wo du abweichen musstest.
