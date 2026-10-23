Bau in zweisamen die Swipe-Karte und das Vollbild neu (Variante 2 „Kacheln") und führe die Banner-Bibliothek ein.

Im Ordner `swipe-karte-v2/` liegen:
- `SWIPE-KARTE-V2.md` – die vollständige Spezifikation (Karte, Banner-Skalierung, Datenmodell, Vollbild)
- `screens/*.html` – Pixel-Referenzen. Bei `Karte.html` gilt **nur `variante="2"`**, 1 und 3 ignorieren. Die `{{ }}`-Werte werden im Script berechnet. Der Google-Maps-Block ist dort nur ein gezeichneter Platzhalter.
- `banners.json` – 76 Banner-Motive als Formenlisten
- `banner-render.js` – Referenz-Renderer, nimm ihn als Vorlage für eine Banner-Komponente in unserem Stack

Vorgehen:
1. Lies die Spec und die Referenzen. Schau dir an, wie Swipe-Karte, Vollbild, Idee-Datenmodell und Google-Maps-Einbindung bei uns aktuell gebaut sind. Schreib mir dann einen kurzen Plan und **warte auf mein OK**. Der Plan soll enthalten: betroffene Dateien, Datenmodell (`motiv` an der Idee), wie du die vorhandenen Ideen auf Motive abbildest und wo `banners.json` liegt.
2. **Banner-Komponente:** `<Banner motiv hoehe breite>` nach der Skalierungsregel in der Spec (`max(h/110, w/350)`, unten mittig, seitlich beschnitten). Fallback `herz`. `aria-hidden`.
3. **Zuordnung:** schlage für jede vorhandene Idee ein Motiv vor (Tabelle im Plan, Titel → Schlüssel). Nichts raten, was nicht passt, bekommt `herz`. Die Farbe kommt aus dem Motiv.
4. **Karte (V2):** feste Höhen aus der Spec, Titel und Beschreibung mit line-clamp, drei Kacheln, Datumsstreifen unten. Die Karte darf keinen Leerraum mehr haben, auch bei kurzen Texten.
5. **Vollbild:** wie in der Spec, mit der festen unteren Leiste „Kompost" / „Einpflanzen". Die echte Google-Maps-Karte (124 hoch, Radius 18) bleibt, Ideen ohne Ort blenden Karte und Button aus.
6. **Optional im Idee-Editor:** Motiv-Auswahl als scrollende Reihe kleiner Banner.
7. **Test:**
   - Prüfe 390 × 844 und 360 × 740 auf Überlappungen und Leerraum.
   - Prüfe lange Titel, sehr kurze Texte, eine Idee ohne Ort und eine ohne festen Termin.
   - Prüfe 5 verschiedene Motive, darunter yoga, zoo, stadion, freizeitpark, shoppen.
   - Spiel einmal durch: Karte wischen → Vollbild → Einpflanzen / Kompost.
   - Mach Screenshots und vergleich sie mit den Referenzen.
8. Zeig mir am Ende, was du geändert hast und wo du abweichen musstest.
