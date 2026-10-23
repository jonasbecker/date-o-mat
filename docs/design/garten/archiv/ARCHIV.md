# Date-O-Mat – Archiv („unser beet.“) + Unterseiten

Ersetzt den Archiv-Teil in `DESIGN-GARTEN.md`. Farben und Schriften bleiben wie dort, alle Maße gelten für 390 × 844.

Referenzen in `screens/`:

| Datei | Seite |
|---|---|
| `Archiv.html` | Übersicht, Prop `ansicht` = stiel \| raster. `ArchivRaster.html` ist der Wrapper für das Raster. |
| `ArchivBlatt.html` | **Blatt-Detail, Variante A** (`variante="a"`, gewählt). B und C im Script ignorieren. |
| `ArchivWieWars.html` | Nachbereitung nach dem Date, Prop `wahl`. `ArchivWieWarsJa.html` zeigt den Zustand „unbedingt“. |
| `ArchivWelk.html` | Ausgefallenes Date |
| `Bloom.html` | Blumen-Komponente |

Die Fotos in den Referenzen sind gezeichnete Platzhalter (`SCENES`/`FOTOS` im Script). In der App kommen dort **echte Fotos** hin (`object-fit: cover`). Daten und Notizen sind Beispiele.

---

## 1. Übersicht

**Kopf**
- Logo
- rechts DM Mono 11: „n Blätter · seit <Monat des ersten Dates>“
- „unser beet.“ 54 px/800
- darunter der Umschalter Stiel | Raster: Pille `--surface`, aktiv `--cta`, `aria-pressed`. Die zuletzt gewählte Ansicht merken.
- rechts daneben in `--butter`: „♥ n× nochmal“. Das ist die Anzahl der Dates, bei denen **beide** „unbedingt“ gesagt haben.

Neueste Dates oben, älteste unten.

### 1a. Stiel

- **Stiel:** 5 px `--stem`, mittig bei x 193.
- **Knospe oben:** gestrichelter Kreis 36 px in #6DBA74. Daneben in Caveat `--butter`: „Nº9 · Fr 30.10. – wächst noch“. Das ist das nächste geplante Date; gibt es keins, entfällt die Knospe.
- **Monatsmarke:** Pille 110 × 24 auf dem Stiel, Rand 1.5 px `--stem`, DM Mono 10 in Großbuchstaben, z. B. „OKTOBER“.
- **Blätter** abwechselnd links und rechts:
  - Foto als Blatt 168 × 150
  - Form: links `border-radius: 90% 0 90% 0`, rotate 6°; rechts `0 90% 0 90%`, rotate −6°
  - Ring `0 0 0 4px #4FA25E`, Zweig 22 × 3 zum Stiel
  - Foto-Zähler unten mittig „1/4“, nur bei mehr als einem Foto
- **Text** gegenüber dem Blatt (zur Mitte ausgerichtet):
  - Avatar 24 px, wer geplant hat (J #E58FA6, L #4D63E8)
  - Titel 16/700, max. 3 Zeilen
  - Datum in DM Mono 11
  - Chip:
    - beide unbedingt → „♥ nochmal: beide“ (`--butter`)
    - einer „nö“ → „einmal reicht“
    - sonst → „nochmal: vielleicht“
- **Welkes Blatt** (ausgefallen): 96 hoch, gestrichelt #5A6E5E, Text „welk“, Titel in `--muted`, Chip „ausgefallen“.
- **Abstände:** Blatt bis Blatt 26 px, nach der Monatsmarke 38 px.

### 1b. Raster

- 2 Spalten mit 10 px Abstand, gruppiert nach Monat. Kopf in DM Mono 11: „OKTOBER“ links, „4 Blätter“ rechts.
- **Kachel:** quadratisches Foto mit Radius `30px 8px 30px 8px` (Blatt-Ecke).
  - oben rechts Badge „♥ nochmal“ (`--butter`), wenn beide unbedingt
  - unten links Foto-Zähler
  - darunter Titel 14/700 (2 Zeilen) und Mini-Avatar 16 px mit Datum in DM Mono 10
- **Ausgefallen:** gestrichelte Kachel mit gestricheltem Blatt-Icon und „AUSGEFALLEN“.

Tippen auf ein Blatt oder eine Kachel öffnet das Blatt-Detail. Ein welkes Blatt öffnet die Welk-Seite.

---

## 2. Blatt-Detail (Variante A · Foto groß)

Vollbild **ohne** Navigationsleiste. Zurück per Pfeil oder Wischgeste.

| Bereich | Spezifikation |
|---|---|
| Foto | volle Breite, 0–440, `object-fit: cover`, unten Verlauf 170 px nach `--bg`. **Wischen** wechselt das Foto. Punkte bei top 300 (aktiv 18 × 6, sonst 6 × 6 mit opacity .5). |
| Kopf (top 16) | Zurück 42 px rund, rgba(17,26,20,.72). Rechts Pille mit „1 / 4“. |
| Titelblock (top 352) | Avatar 22 + DM Mono 11 „LOTTE HAT GEPLANT · Nº8“ · Titel 30/800 · Meta in DM Mono 11: „DO 22.10. · 19:10–20:40 · RHEINAUHAFEN · 6 €“ |
| Mini-Fotos (top 492) | 60 × 60, Radius `20px 6px 20px 6px`, aktives mit Ring 3 px `--text`. Danach eine gestrichelte „+“-Kachel zum Hinzufügen. Bei vielen Fotos horizontal scrollen. |
| Nochmal? (top 568) | Karte `--surface` 56 hoch: Label „NOCHMAL?“, dann je Person eine Pille (Avatar 28 + Antwort). |
| Notizen (top 636) | Karte `--surface`, pro Person Avatar 22 + Text in Caveat 600 20 px `--butter`. Wer noch nichts geschrieben hat, wird weggelassen. |
| Aktionen (unten 22) | „Nochmal pflanzen“ (gefüllt `--cta`, 54 hoch, legt die Idee als neue Planung an) + „Teilen“ (Outline) |

Ist die Seite länger als der Bildschirm, scrollt sie, und die Aktionen bleiben unten fixiert.

---

## 3. „wie war’s?“ (nach dem Date)

Öffnet sich automatisch beim ersten App-Start nach dem Ende des Dates (Push optional). Bis zum Ausfüllen erscheint auf der Startseite ein Hinweis. Vollbild ohne Navigation.

1. **Kopf:** ✕ und „Nº9 · FR 30.10.“, dann „wie war’s?“ 54/800, Titel des Dates 16 px `--muted`.
2. **Fotos** (top 166, 190 hoch):
   - Fläche gestrichelt #3A4A40 in Blattform (`border-radius: 0 90px 0 90px`) mit Kamera-Icon, „Fotos aufs Blatt“ und „bis zu 10 · Lotte sieht sie auch“.
   - Nach dem Hinzufügen zeigt die Fläche die Fotos als Reihe, + bleibt.
3. **Nochmal?** 3 Optionen als `radiogroup`, Kacheln 98 hoch, aktiv `--cta`:
   - **nö:** welkes braunes Blatt
   - **vielleicht:** Knospe
   - **unbedingt:** Blüte
4. **Blume** reagiert (scale 0.3, links), Sprechblase vom Mund aus mit Punkten:

| Wahl | Stimmung | Spruch |
|---|---|---|
| noch nichts | wartet | „und? erzähl! ich war ja nicht dabei.“ |
| nö | traurig (1 Blatt welk) | „okay. kompost. passiert den besten.“ |
| vielleicht | froh | „solide. 7 von 10 blättern.“ |
| unbedingt | blueht | „JAAA! ich blüh gleich mit.“ |

5. **Notiz** „EIN SATZ FÜR SPÄTER“: Textfeld in Caveat 21 `--butter`, max. ~120 Zeichen.
6. **Hinweis** in DM Mono 10: „Lotte hat schon geantwortet – du siehst es nach dir.“ Die Antwort der anderen Person wird erst sichtbar, wenn man selbst gespeichert hat.
7. **„Blatt anheften“:**
   - ausgegraut, bis eine Nochmal-Antwort gewählt ist
   - speichert und öffnet das Blatt-Detail
   - das Blatt wächst ab dem ersten Speichern, die Antwort des anderen ergänzt sich später

---

## 4. Welkes Blatt (Date fiel aus)

- **Kopf:** Zurück und „Nº6 · WOCHE 41“, dann „fiel aus.“ 54/800 in `--text-soft`, darunter der Titel.
- **Blume:** `traurig` mit 1 welken Blatt, scale 0.5. Sprechblase vom Mund: „passiert. gießen wir’s nochmal?“
- **Info-Karte** (`--surface`, Zeilen 48 hoch):
  - GEPLANT VON (Avatar + Name)
  - WAR GEDACHT (Datum und Uhrzeit)
  - WARUM: Chip mit Grund, z. B. krank, keine Zeit, Wetter, anderes; dazu „+ notiz“
- **Hinweis** mit gestricheltem Blatt-Icon: „Welke Blätter bleiben am Stiel – gehört dazu. …“
- **Aktionen:** „Neuen Termin finden“ (gefüllt) · „Zurück ins Regal legen“ (Outline, Idee zurück in die Ideen) · „Blatt entfernen“ (Text-Link `--muted-2`, mit Bestätigung)

---

## 5. Daten

```ts
type Blatt = {
  nr: number;                       // fortlaufend, Nº
  ideeId: string;
  geplantVon: 'jonas' | 'lotte';
  start: string; ende?: string;     // ISO
  ort?: string; kosten?: string;
  status: 'gewachsen' | 'welk';
  fotos: { url: string; von: 'jonas' | 'lotte' }[];
  nochmal: { jonas?: 'noe' | 'vielleicht' | 'unbedingt'; lotte?: 'noe' | 'vielleicht' | 'unbedingt' };
  notizen: { jonas?: string; lotte?: string };
  welkGrund?: 'krank' | 'keine-zeit' | 'wetter' | 'anderes';
  welkNotiz?: string;
};
```

- **Fotos:** komprimiert hochladen (lange Kante max. ~2000 px). Kleine Vorschaubilder für Stiel und Raster.
- **Ohne Foto:** Statt eines Fotos die Pastellfarbe und Illustration der Idee zeigen (siehe `SWIPE-KARTE.md`).
