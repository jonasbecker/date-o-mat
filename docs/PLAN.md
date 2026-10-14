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

Abweichungen in V2:

1. Bewertung **je Person** (neue Tabelle `date_reviews`) statt einer gemeinsamen Bewertung in
   `date_plans.rating`/`review_note`; die beiden unbenutzten Spalten sind entfernt.
2. Untere Leiste: „Dates“ ersetzt „Einstellungen“; die Einstellungen öffnet das Regler-Symbol
   oben auf der Startseite.
3. Reihenfolge: M12 (Event-Quellen) vor M9–M11, auf Wunsch.
4. Event-Quellen: Der Server holt die Seiten selbst und Claude wertet nur den Text aus, statt
   Claudes Web-Fetch-Werkzeug zu nutzen – günstiger, lokal testbar, und Seiten mit JSON-LD
   brauchen gar keine KI. Dafür gibt es einen SSRF-Schutz für eingetragene Adressen.

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
