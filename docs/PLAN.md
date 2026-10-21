# Plan V1 (freigegeben am 13.10.2026)

Ziel: Die App stößt zwei Studenten aktiv an, regelmäßig Dates zu planen, und macht das Planen
reibungsarm. Alles, was dazu nicht beiträgt, ist nicht in V1.

Design-Richtung: [Canvas „Date-O-Mat Designrichtung“](https://claude.ai/artifact/BXRwu39TC5ZEqAzYVuwyCL) (privat).

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Name | Date-O-Mat (Logo: Kaugummiautomat voller Herzen) |
| Repo / Branch | `jonasbecker/date-o-mat`, direkt auf `main` |
| Kalender | mehrere Kalender pro Person auswählbar (`calendar.calendarlist.readonly`) |
| Google OAuth | Status „In Produktion“, unverifiziert. Im Testmodus laufen Refresh-Tokens nach 7 Tagen ab. |
| Zugang | `ALLOWED_EMAILS` + Einladungscode (6 Zeichen, 48 h, ab 2 Mitgliedern keine Beitritte mehr) |

## Stack

Next.js (App Router, Cache Components) + TypeScript · Tailwind CSS · Postgres bei Neon + Drizzle ORM ·
Vercel Hobby (Region fra1) · cron-job.org (alle 5 Min, Vercel-Hobby-Crons laufen nur täglich) ·
eigener Google-OAuth-Flow mit `google-auth-library` · `web-push` + eigener Service Worker ·
Luxon für Zeitzonen · Vitest.

## Kernregeln

**Zyklus**
- Rhythmen: wöchentlich (Mo–So, Default), alle 2 Wochen, 2× im Monat (1.–15. / 16.–Ende), monatlich.
  Grenzen jeweils 00:00 Europe/Berlin.
- Abwechselnd: Wer dran ist, wechselt nach *jedem* Zyklus, auch nach einem ausgefallenen.
- Vorschlag: Die App erzeugt zum Zyklusstart Slot und Idee. Wer übernimmt, wird Organizer.
- Status: offen → geplant (Event wird sofort angelegt, Partnerin eingeladen) → bestätigt („Passt!“) →
  stattgefunden (automatisch nach dem Ende, rücknehmbar). Ohne Date am Zyklusende: übersprungen,
  mit freundlichem Hinweis.
- Ein geänderter Rhythmus gilt ab der nächsten Runde. Ein geänderter Modus gilt sofort, solange die
  Runde offen ist, sonst ab der nächsten.

**Slot-Finder**: FreeBusy beider Personen + Puffer → vereinigen → im Tagesfenster invertieren →
30-Minuten-Raster. Suchfenster: jetzt + Vorlauf bis Zyklusende (Horizont als Obergrenze,
„auch später suchen“ optional). Ranking: Abend/Wochenende, früher im Zyklus, höchstens ein Slot pro Tag.

**Erinnerungen** (je Person einzeln abschaltbar): Du bist dran (Zyklusstart, frühestens 9 Uhr),
Deadline naht (24 h vorher), Aktion der anderen Person (sofort), Date morgen (Vortag 19 Uhr),
Date in 2 h. Ruhezeit 22–8 Uhr, außer für „in 2 h“.

## Defaults

| Einstellung | Wert |
|---|---|
| Rhythmus / Modus | wöchentlich / abwechselnd |
| Deadline | 3 Tage vor Zyklusende, 20:00 |
| Kleines Date | 2 h, Start 10:00–21:00 |
| Großes Date | 5–9 h, Start 09:00–13:00 |
| Spätestes Ende | 23:00 |
| Vorlauf / Puffer / Horizont | 12 h / 30 Min / 14 Tage |

## Meilensteine

| | Inhalt | Status |
|---|---|---|
| M1 | Grundgerüst, Google-Login, Allowlist, Paar-Kopplung, Schema | ✅ |
| M2 | Wunschliste mit Schnell-Erfassen | ✅ |
| M3 | Kalender verbinden, FreeBusy, Slot-Finder | ✅ |
| M4 | Einstellungen, Zyklus-Engine, Startseite, Vorschlag-Modus, Cron-Tick | ✅ |
| M5 | Google-Event mit Einladung, Sync bei Änderung/Absage | ✅ |
| M6 | Web Push, iOS-Onboarding, Erinnerungen | ✅ |
| M7 | Design-Politur, PWA-Feinschliff, Deployment, README | ✅ |

## V2 (freigegeben am 14.10.2026)

| Thema | Entscheidung |
|---|---|
| Umfang | Rückblick, Fotos, kuratierte Köln-Ideen + „Überrasch uns“, KI-Vorschläge |
| Fotos | Vercel Blob, privater Store; Auslieferung nur über die App mit Login-Prüfung |
| KI | Claude Haiku 5.5 über die Anthropic API (`ANTHROPIC_API_KEY`), Wetter von Open-Meteo |

| | Inhalt | Status |
|---|---|---|
| M8 | Rückblick: Herzen + Notiz je Person, „Wie war's?“-Push, Seite „Unsere Dates“ | ✅ |
| M9 | Fotos zum Rückblick | ✅ |
| M10 | Kuratierte Köln-Ideen, „Überrasch uns“ | ✅ |
| M11 | KI-Vorschläge | ✅ |
| M12 | Event-Quellen (rausgegangen, koeln.de, KölnTourismus, Mit Vergnügen) – vorgezogen | ✅ |
| M13 | Verständlich & aufgeräumt (Einführung, nächster Schritt, ⓘ-Hilfen, Planen gebündelt) | ✅ |
| M14 | Tests + CI im Repo (E2E-Suites mit Mocks, GitHub Actions) | ✅ |
| M15 | Link → Idee (TikTok/Instagram/YouTube/Webseite, Teilen-Ziel auf Android) | ✅ |
| M16 | Status & Warnungen („Läuft alles?“, Cron-Hinweis, Push bei getrenntem Kalender) | ✅ |
| M17 | Entdecken: Ideen-Stapel zum Swipen mit Match, Rückgängig, Super-Like, Event-Kombis, Nachrichten | ✅ |
| M18 | Budget & Spartopf (Monatsbudget, echte Kosten, Spartopf, Monatsrückblick) | ✅ |
| M19 | Besondere Tage, „Vielleicht“-Stapel, alte Ideen auffrischen | ✅ |
| M20 | Date-Story (Jahresrückblick) & Statistik | ✅ |
| M21 | Extras: iOS-Kurzbefehl zum Teilen, Überraschungs-Date, Vorbereitungs-Checkliste, Anfahrt, Gesprächskarten | ✅ |
| M22 | Aufräumen: ein Filter, 3 Ideen-Reiter, Planen ohne Reiter, Extras nach und nach, Einstellungen gestaffelt, Kontrast | ✅ |
| M23 | Event-Quellen mit Unterseiten (KI wählt bis zu 6, bearbeitbar) | ✅ |
| M24 | Navigation Ideen · Date planen · Dates, Startseite aufgeteilt, `/` leitet passend weiter | ✅ |
| M25 | Idee antippen: planen oder das nächste Date tauschen (Termin bleibt); ein 💚 beim Swipen speichert sofort | ✅ |
| M26 | Ein Ablauf: Start mit dem, was ansteht, darunter Idee → Zeit → fertig; keine Leiste unten, Icons oben | ✅ |
| M27 | Ohne Scrollen: Bildschirme passen, Durchklicken statt Scrollen; nur Wunschliste und Events scrollen | ✅ |
| M28 | Feinschliff: Zeiten erst bei Bedarf laden, Reihenfolge, Rundenkarte, eine Ideen-Karte, Begriffe, Einstellungs-Gruppen, Push-Ziele | ✅ |
| M29 | Design A: diszipliniertes Sticker-Design, Farbrollen, Icons, Maskottchen, Fotoraster, Daumenzone | ✅ |
| M30 | Ideen-Aufbau: eine Wunschliste, Swipen auf dem Start wenn nichts zu planen ist, „Nächstes Mal?“, „Was läuft“ im Planen | ✅ |
| M31 | Start = Kasten + Swipe-Karte; „Date planen“ im Kasten öffnet die Wunschliste als eigenen Schritt; 💡 ohne Reiter | ✅ |
| M32 | Icons rechts, Seiten klappen von oben herunter; kompakte Swipe-Karte (nur ✕ ↩️ 💚, „Vielleicht“ und Super-Like entfallen) | ✅ |
| M33 | Erinnerungen sind Pflicht: Push in der Einführung, Ein-Tipp-Zeile auf dem Start, Hinweis wenn die andere Person keins hat, Hilfe bei verweigerter Erlaubnis | ✅ |
| M34 | Start: der Kasten bekommt den Platz, wenn etwas ansteht (Swipen = eine Zeile); „Wie war's?“ mit Foto und Herzen | ✅ |
| M35 | Top-Tipp passt zur Idee: Sonnenuntergang und Wetter für Draußen-Ideen, Begründung an der Zeit | ✅ |
| M36 | Swipen befriedigend: Kategorien als Chips, Herkunft sichtbar, Fortschritt, Stapel, Flug zum 💡 | ✅ |
| M37 | Untere Leiste mit großem Logo (Date planen) in der Mitte, Ideen links, Dates rechts; Einstellungen oben | ✅ |
| M38 | Start nie leer: die Swipe-Karte füllt den Rest, die eine Zeile nur bei zu wenig Platz | ✅ |

Abweichungen in V2:

1. Bewertung **je Person** (neue Tabelle `date_reviews`) statt einer gemeinsamen Bewertung in
   `date_plans.rating`/`review_note`; die beiden unbenutzten Spalten sind entfernt.
2. Untere Leiste: „Dates“ ersetzt „Einstellungen“; die Einstellungen öffnet das Regler-Symbol
   oben auf der Startseite.
3. Reihenfolge: M12 (Event-Quellen) vor M9–M11, auf Wunsch.
4. Event-Quellen: Der Server holt die Seiten selbst und Claude wertet nur den Text aus, statt
   Claudes Web-Fetch-Werkzeug zu nutzen – günstiger, lokal testbar, und Seiten mit JSON-LD
   brauchen gar keine KI. Dafür gibt es einen SSRF-Schutz für eingetragene Adressen.
5. Link → Idee schaut sich nicht das Video an, sondern was der Post über sich verrät
   (Bildunterschrift, Vorschaubild, Seitentitel). Videos herunterzuladen wäre teuer, langsam
   und verstößt gegen die Nutzungsbedingungen der Plattformen.
6. Eine stehende Automatik kann sich nicht selbst per Push melden (der Push käme ja aus dem
   Cron) – deshalb Hinweis auf der Startseite statt Push.
7. Anfahrt: statt „ca. 25 Min. mit der KVB“ ein Link zu Google Maps (ÖPNV) – eine Fahrzeit in
   der App bräuchte einen Routen-Dienst mit Schlüssel und Kosten.
8. iPhone-Teilen über einen Kurzbefehl mit persönlichem Schlüssel statt eines fertigen
   Kurzbefehls zum Herunterladen (Apple verlangt dafür signierte Dateien).
9. Der Filter wird pro Gerät gespeichert (nicht pro Paar): Jede:r stöbert anders, und so bleibt
   er auch ohne Server-Anfrage sofort da.
10. Die Stimmungs-Auswahl der KI-Ideen (gemütlich, aktiv …) ist mit M22 entfallen – sie war
    der vierte Filter neben Dauer, Budget und Ort; die KI überrascht jetzt immer.
11. Seit M25 speichert schon ein einzelnes 💚 beim Swipen auf die gemeinsame Wunschliste (vorher
    nur ein Match). Ein Match bleibt sichtbar („💞 Match“), die Karte bleibt im Stapel des anderen.
12. „Statt … machen“ tauscht nur die Idee eines Dates, der Termin und ein „Passt!“ bleiben – ein
    neuer Termin geht weiter über „Termin ändern“.
13. Seit M26 gibt es keine Reiter mehr (M24 hatte drei): Planen ist der Start, erst die Idee, dann
    die Zeit. Beim Termin-Ändern bleibt die Idee fest – tauschen geht über „Lieber was anderes?“.
14. Seit M27 scrollt nur, was eine Liste ist (Wunschliste, Events, Sheets, lange Einstellungen).
    Passt ein Bildschirm auf einem sehr kleinen Handy nicht, scrollt er ausnahmsweise doch, statt
    Inhalt abzuschneiden.
15. Seit M31 ist der Start nicht mehr Schritt 1 des Planens: Er zeigt einen Kasten und die
    Swipe-Karte, „Date planen“ öffnet die Wunschliste. Checkliste, Zeit ändern und Absagen liegen
    unter „Details“ (die Seite des Dates), die Gesprächskarten am Tag als Link im Kasten.

16. Seit M33 ist Push keine Checklisten-Zeile mehr, sondern eine eigene, nicht wegklickbare Zeile
    auf dem Start, bis ein Gerät angemeldet ist (Einführung fragt schon danach).
17. Seit M34 hängt die Größe der Swipe-Karte am Zustand (`deckSize()`), nicht mehr jeder Zustand
    zeigt sie groß.
18. Seit M35 ist die Zeitenliste idee-abhängig: Draußen-Ideen werden nach Tageslicht und Wetter
    gewertet. Dafür bekam `ideas` die Spalte `setting` (vorher gab es das nur an Swipe-Karten).
    Dunkelheit ist gewollt bei Stichwörtern (`darknessWanted()`), statt eines Felds an der Idee –
    es greift für alle Quellen (Wunschliste, Swipen, Köln-Liste, KI) ohne Formularfeld.
19. Seit M36 hat `ideas` eine optionale `category`; ohne sie schließt `categoryOf()` aus dem Text.
    Die Kategorie hängt am gemeinsamen Filter, damit sie überall gleich gilt. „Geswipt“ und „Matches“
    sind Ansichten der Wunschliste, keine zweite Liste; die Herkunft kommt aus `ideas.source`.
20. Seit M37 gibt es wieder eine Leiste unten (M26 hatte sie abgeschafft): der Daumen erreicht das
    Wichtigste, und das Logo als Mitte führt von jeder Seite zum Start ; auf dem Start selbst klappt es Aktionen auf (nichts passiert, bevor man eine wählt). Die
    Zähler-Marke `data-header-icon="wishlist"` sitzt jetzt dort (das 💚 beim Liken fliegt hin).
21. Seit M38 entscheidet der Platz statt nur der Zustand, ob die Swipe-Karte oder eine Zeile steht
    (`deckSize()` sagt nur noch, ob der Kasten Vorrang hat); reines CSS, damit nichts springt.
22. Seit M40 gilt das Design „Pastell & rund“ aus `docs/design/DESIGN.md`. Es löst M29 (Sticker),
    M37 (Logo in der Mitte) und M38 (Swipe-Karte auf dem Start) ab: Swipen hat einen eigenen Platz in
    der Mitte der Leiste, der Start ist das Beet. Planen ist ein Screen statt zwei Schritte; die
    Zeiten richten sich weiter nach der gewählten Idee (Draußen-Ranking). Die Personenfarben bleiben
    wählbar (himmel = Blau, mandarine = Rosé). „Anstupsen“ schickt höchstens einmal pro Stunde einen
    Push (`notification_log`, Typ `nudge`).

## Review-Runde (21.10.2026) – offen, nach Wirkung sortiert

Aus dem kritischen Durchgang durch die ganze App (alle Screens auf fünf Handy-Größen + Code-Review).
Schon erledigt: Swipe-Karte passt immer (misst sich selbst, auch wenn der Platz später schrumpft),
oberste Karte bleibt liegen, Tasten-Wächter, „hat doch nicht geklappt“ mit Rückfrage, Kanne abgeben
ohne Hin-und-her + Push, Anstupsen ehrlich, „wann?“ fängt sich, Kosten nur wenn geändert, Merken
einmal, Rückfragen beim Entfernen/Trennen, Willkommen-Texte, Manifest dunkel, „1.000 €“.

1. ~~**Dev-Tools in Produktion aus**~~ – bleibt an (Entscheidung 21.10.: die Dev-Uhr wird zum Testen
   gebraucht; die Pille „dev-uhr“ zeigt, wenn sie verschoben ist).
2. ✅ **Dates über die Rundengrenze** („Auch danach suchen“): das Date gehört in die Runde, in der es
   stattfindet – sonst zeigt das Beet nächste Woche „du bist dran.“, versteckt das Date, und die Runde
   welkt, obwohl ihr eins hattet.
3. ✅ **Nur zugesagte Dates zählen als erlebt**: ein nie bestätigter Vorschlag wird heute nach Ablauf
   „done“ (Blatt, Budget, „Wie war's?“). Jetzt fragt das Beet „habt ihr's gemacht?“ (Ja zählt).
4. ✅ **Gleichzeitig handeln**: „Zusagen“ bestätigt nur die Zeit, die man gesehen hat; eine Verschiebung
   holt kein gerade abgesagtes Date zurück (Status-Wächter, eigene Meldung „wurde abgesagt“).
5. ✅ **Eingeladene Person kann absagen** (heute nur „Zusagen“ oder „Anderer Termin“).
6. ✅ **Push einmal, nicht dreimal** (21.10.: nur die Blume auf dem Beet + der Schalter im Setup): ein gemeinsamer Push-Zustand in den Einstellungen (Banner und
   Schalter widersprechen sich), der Hinweis auf dem Beet nur noch als Sprechblase der Blume.
7. **Beet aufräumen**: zu viele Zeilen machen die Blume winzig; die Blume sagt Passendes (nicht „wer
   gießt?“, wenn du dran bist); „sam ist dran.“ nach dem Gießen → „wartet auf sam.“ ✅; Blumengröße
   über alle Zustände gleich.
8. ✅ **„Anderer Termin“** bietet auch Zeiten an, die das alte Date überlappen (es blockiert sich selbst).
9. ✅ **Sams Kalender fehlt und du bist dran**: Anstupsen + Kanne abgeben statt Sackgasse.
10. ✅ **Abgesagtes Date** zeigt „wurde abgesagt“ statt „Hier ist nichts“; Absage-Text je nach Rolle,
    Fehler sichtbar.
11. ✅ **Rückgängig beim Swipen** (nur dein Like geht, wenn die Idee schon weiterlebt): Idee nicht hart löschen (Vorschläge, Änderungen der anderen Person);
    ein geplanter Swipe blockiert nicht alle früheren.
12. ✅ **„Meine Likes“** (nur eigene + Matches) zeigt auch die Likes der anderen Person – verrät das blinde Swipen. Nur eigene
    zeigen oder umbenennen.
13. ✅ **Ein Name pro Ort** („einstellungen.“, „archiv.“): Tab „Einstellungen“ / Seite „setup.“ / „der gartenschuppen“; Archiv heißt
    „unser beet.“, obwohl der Start-Tab „Beet“ ist.
14. ✅ **„wann?“**: große Lücke zwischen Zeiten und Senden-Kasten; der Senden-Knopf ist blau statt der
    hellen Haupt-Pille.
15. ✅ **Tipp-Ziele ≥ 44 px** (`hit`: unsichtbare Fläche, das Aussehen bleibt): Details ›, Lieber was anderes?, Weitere Zeiten, ⓘ, Filter,
    Matchlinge-Pille, Größen-Umschalter, Herzen klein.
16. ✅ **Karte ohne freien Abend** („irgendwann.“): kein großes Wochenend-Datum, das wie ein Vorschlag aussieht.
17. **„Was läuft“ auffindbar machen** (heute ein kleiner Link oben auf /ideas).
18. **Weniger Google-Abfragen**: doppelte Vorschläge im Vorschlag-Modus (eindeutig pro Runde),
    FreeBusy der Swipe-Seite ein paar Minuten zwischenspeichern.
19. ✅ **Google-Zusage nach Verschieben prüfen**: ein altes „accepted“ darf die neue Zeit nicht
    bestätigen (`responseStatus` zurücksetzen).
20. **Gießzeit-Auswahl** passend zum Rhythmus und mit der echten Uhrzeit (nicht immer „20:00“).
21. Kleinkram: „Jetzt lesen“ sagt, wann es wieder geht; Tab „Sam“ → „Sams Herzen“; „keimt!“ mit
    Escape/Fokus; Zoomen erlauben; eigener Code beim Beitreten erklärt; „Ihr seht euch Dienstag“ am
    selben Tag → „heute“; Date um 00:30 bekommt „Morgen ist Date-Tag“ zur richtigen Zeit; Fehler
    offline zeigen statt Fehlerseite.

## Bewusste Abweichungen vom ursprünglichen Auftrag

1. OAuth „In Produktion (unverifiziert)“ statt Testmodus (7-Tage-Token-Ablauf).
2. Externer Cron (cron-job.org), weil Vercel Hobby nur tägliche Crons erlaubt.
3. „Sofort sichtbar“ über Neuladen bei Fokus + alle 15 s statt Websockets.
4. Ganztägige Termine blockieren nur, wenn sie in Google auf „Beschäftigt“ stehen (FreeBusy-only-Scope).
5. Das Google-Event entsteht schon bei „geplant“, nicht erst bei „bestätigt“.
6. Dev-Uhr (nur in Dev-Builds) zum Vorspulen über mehrere Zyklen.
7. FreeBusy-Scope `calendar.events.freebusy` statt `calendar.freebusy`, weil er laut Google auch
   Kalender abdeckt, auf die man nur Zugriff hat (z. B. abonnierte Uni-Kalender).
8. Calendar API per `fetch` statt `@googleapis/calendar`: drei Endpunkte, kein großes SDK nötig.

## Für später

- **Event-Quellen über die Batch-API lesen** (50 % günstiger): Der Tick schickt alle fälligen
  Quellen morgens als einen Batch ab, ein späterer Tick holt die Ergebnisse ab (meist nach
  Minuten, spätestens nach 24 Std.). Braucht eine Spalte für die Batch-ID und einen
  Abhol-Schritt im Tick. „Jetzt lesen“ bleibt eine normale Anfrage. Lohnt sich erst bei
  deutlich mehr Quellen – heute kostet das Lesen weniger als 1 € im Monat.
