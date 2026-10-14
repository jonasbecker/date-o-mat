# Date-O-Mat 💞

Eine kleine PWA für genau ein Paar: Sie erinnert euch daran, regelmäßig Dates zu planen,
schlägt freie gemeinsame Zeiten aus euren Google-Kalendern vor und verwaltet eure
gemeinsame Ideen-Wunschliste.

- **Setup & Deployment:** [docs/SETUP.md](docs/SETUP.md)
- **Plan, Entscheidungen, Meilensteine:** [docs/PLAN.md](docs/PLAN.md)

## Stand

| Meilenstein | Inhalt | |
|---|---|---|
| M1 | Google-Login, Allowlist, Paar-Kopplung per Einladungscode | ✅ |
| M2 | Wunschliste mit Schnell-Erfassen, Filter, Bearbeiten | ✅ |
| M3 | Kalender verbinden, Kalenderauswahl, Slot-Finder, Slot-Einstellungen | ✅ |
| M4 | Rhythmus, Modi (abwechselnd/Vorschlag), Runden, Startseite, Cron-Tick, Dev-Uhr | ✅ |
| M5 | Date festlegen, Google-Termin mit Einladung, Passt!/Ändern/Absagen synchron | ✅ |
| M6 | Web Push, Erinnerungen, iPhone-Installationshilfe, App-Manifest | ✅ |
| M7 | Fehler-/Offline-Seiten, App-Kurzbefehle, Sicherheits-Härtung, Aufräum-Job, Doku | ✅ |
| **V2** | | |
| M8 | Rückblick: „Wie war's?“-Erinnerung, Herzen + Notiz je Person, Seite „Unsere Dates“ | ✅ |
| M9 | Fotos zum Rückblick (Vercel Blob, privat) | ✅ |
| M10 | Kuratierte Köln-Ideen, „Überrasch uns“ | ✅ |
| M11 | KI-Vorschläge (Claude Haiku 5.5, Wetter von Open-Meteo) | ✅ |
| M12 | Event-Quellen: Lieblings-Seiten täglich lesen, „Was läuft“ mit Frei-Prüfung | ✅ |

## Tech-Stack

| | |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4, Design-Tokens in `src/app/globals.css` |
| Datenbank | Postgres (Neon), Drizzle ORM, Migrationen in `drizzle/` |
| Hosting | Vercel (Region Frankfurt) |
| Auth | eigener Google-OAuth-Flow (PKCE) mit `google-auth-library`, DB-Sessions |
| Tests | Vitest |

## Architektur

```
Handy (PWA) ──HTTPS──▶ Next.js auf Vercel ──▶ Neon Postgres
                         ├─▶ Google OAuth / Calendar API
                         └─▶ Web Push
cron-job.org ── alle 5 Min ──▶ /api/cron/tick   (Runden weiterschalten, Vorschläge, Erinnerungen)
```

```
src/
  app/                Seiten (UI) und Route Handler (API)
    (app)/            eingeloggter Bereich mit Navigation
    login/, pair/     Login und Kopplung
    api/auth/google/  OAuth-Start und -Callback
    api/cron/tick/    Einstieg für cron-job.org
    manifest.ts       App-Manifest (Name, Icons, Kurzbefehle)
    error.tsx, not-found.tsx, global-error.tsx   freundliche Fehlerseiten
  components/         UI-Bausteine (Button, Card, Avatar, Logo …)
  core/               Kernlogik ohne I/O: Slots, Runden, Vorschläge, Erinnerungen (getestet)
  lib/                kleine Hilfsfunktionen ohne Server-Zugriff (getestet)
  server/             alles mit DB, Secrets oder Google
    auth/             Sessions, Data Access Layer (requireUser/requireCouple), OAuth
    db/               Drizzle-Client und Schema
    google/           Token-Verwaltung (verschlüsselt, Refresh) und Calendar-API per fetch
    availability.ts   FreeBusy beider Kalender → Slot-Finder
    cycles.ts         Runden-Engine (anlegen, abschließen, Status)
    suggestions.ts    Vorschlag-Modus
    idea-sources/     austauschbare Ideen-Quellen (V1: Wunschliste)
    dates.ts          Dates planen/ändern/bestätigen/absagen + Abgleich mit Google
    push.ts           Push-Abos, Einstellungen, Versand (web-push)
    notifications.ts  Texte und Versand der Erinnerungen
    tick.ts           der periodische Job hinter /api/cron/tick (inkl. Aufräumen)
  proxy.ts            schickt Besucher ohne Session-Cookie zur Login-Seite
public/sw.js          Service Worker: Push anzeigen, Offline-Seite (public/offline.html)
drizzle/              SQL-Migrationen (generiert)
scripts/              Migration beim Build, Secret-Generator
```

**Muster, die sich durchziehen**

- **Data Access Layer:** Seiten und Server Actions holen den Nutzer immer über
  `requireUser()`/`requireCouple()` aus `src/server/auth/dal.ts`. `proxy.ts` ist nur eine
  schnelle Vorabprüfung.
- **Cache Components:** Alles, was Cookies oder die Datenbank liest, steht in einer
  `<Suspense>`-Grenze innerhalb der Seite. Layouts bleiben statisch.
- **Kein DB-Enum:** Statuswerte sind `text`-Spalten mit TypeScript-Typen (`src/lib/domain.ts`).
  Neue Werte brauchen daher keine Migration.
- **Frische Daten ohne Websockets:** `AutoRefresh` (`src/components/auto-refresh.tsx`) lädt
  die Seite neu, wenn die App wieder in den Vordergrund kommt, und alle 15 s, solange sie
  sichtbar ist. Server Actions rufen nach Änderungen `refresh()` auf.
- **Bottom Sheets** basieren auf dem nativen `<dialog>` (`src/components/sheet.tsx`):
  Fokus, Escape und Hintergrund-Klick macht der Browser.
- **Kernlogik ohne I/O** (`src/core`: Slots, Zyklen, Erinnerungen) liegt als reine
  Funktionen vor und ist mit Tests abgedeckt, inklusive Zeitumstellung, Terminen über
  Mitternacht, ganztägigen Terminen und vollen Kalendern.
- **Google nur bei echten Anfragen:** Next.js rendert Seiten für das Prefetching vorab.
  Jeder Calendar-API-Aufruf beginnt deshalb mit `await connection()`, damit Google nur bei
  echten Seitenaufrufen gefragt wird.

### Runden in Kürze

- Rhythmus: jede Woche (Mo–So), alle 2 Wochen, 2× im Monat (1.–15. / 16.–Ende), jeden Monat.
  Grenzen sind immer 00:00 Uhr Berlin, die Zeitumstellung ist berücksichtigt (`src/core/cycles.ts`).
- Runden schließen lückenlos aneinander an. Den nächsten Rundenwechsel legen der Cron-Tick
  oder der nächste Seitenaufruf an, je nachdem, was zuerst kommt (idempotent).
- **Abwechselnd:** Runde 1 gehört der Person, die das Paar gestartet hat, danach wird
  abgewechselt, auch nach ausgefallenen Runden. „Ich übernehme diese Runde“ tauscht die
  Reihenfolge ab sofort.
- **Vorschlag:** Pro Runde gibt es einen gemeinsamen Vorschlag (bester freier Slot + die
  Idee, die am längsten auf der Wunschliste wartet; jede zweite Runde bevorzugt groß).
  „Anderer Vorschlag“ verwirft ihn, verworfene Slots und Ideen kommen nicht wieder.
- Status: offen → geplant → bestätigt → stattgefunden; ohne Date am Rundenende: übersprungen.
- Neuer Rhythmus gilt ab der nächsten Runde; Modus und Deadline gelten sofort, solange die
  Runde offen ist.
- **Dev-Uhr:** Mit `ENABLE_DEV_TOOLS=1` erscheint in den Einstellungen „Dev-Uhr“: Zeit um
  Tage oder Wochen vorstellen, damit lassen sich mehrere Runden in Minuten durchspielen.

### Google-Termin in Kürze

- **Festlegen:** Wer festlegt, wird Organisator:in; der Termin landet in dessen Hauptkalender, die
  andere Person wird als Gast eingeladen (`sendUpdates=all`, also mit Google-Einladung).
  Kurz vor dem Speichern prüft die App per FreeBusy noch einmal, ob der Slot frei ist.
- **Bestätigen:** Die Person, die die Zeit *nicht* vorgeschlagen hat, tippt „Passt!“. Nimmt sie
  die Einladung stattdessen in Google an, übernimmt der Cron-Tick das als Bestätigung.
- **Ändern:** Beide können Zeit und Idee ändern. Der Termin wird verschoben (gleiches Event),
  danach muss die jeweils andere Person wieder bestätigen.
- **Absagen:** Das Event wird gelöscht (Google schickt die Absage), die Runde ist wieder offen.
  Löscht die organisierende Person den Termin direkt in Google, sagt der Tick das Date in der App ab.
- **Robust:** `syncDate()` bringt das Google-Event immer auf den Stand der Datenbank (anlegen,
  ändern oder löschen). Die Event-ID wird aus der Date-ID abgeleitet, deshalb kann ein
  Wiederholungsversuch nie einen doppelten Termin erzeugen. Fehlgeschlagene Syncs versucht der
  Cron-Tick erneut (bis zu 10-mal); bis dahin zeigt die Startseite einen Hinweis.

### Erinnerungen in Kürze

- **Web Push** mit VAPID (`web-push`), eigener Service Worker `public/sw.js`. Jede Person kann
  mehrere Geräte anmelden; tote Abos (404/410) räumt der Server beim Senden selbst weg.
- **iPhone:** Push gibt es nur, wenn die App auf dem Home-Bildschirm installiert ist (iOS 16.4+).
  In Safari zeigen Startseite und Einstellungen deshalb eine Schritt-für-Schritt-Anleitung.
- **Arten** (je Person einzeln abschaltbar): Du bist dran (Rundenstart, frühestens 9 Uhr),
  Deadline in 24 Std., Partner:in plant/bestätigt/sagt ab/bewertet, Date morgen (19 Uhr am Vortag),
  Date in 2 Stunden, „Wie war's?“ (Tag danach, 11 Uhr).
- **Wann:** `src/core/reminders.ts` berechnet rein aus Runde, Date und Uhrzeit, was fällig ist.
  Ruhezeit 22–8 Uhr (außer „Date in 2 Stunden“); was mehr als 2 Std. zu spät wäre, entfällt.
- **Genau einmal:** Vor dem Senden wird jede Erinnerung in `notification_log` eingetragen
  (eindeutiger Schlüssel). Nur wenn das klappt, geht sie raus – parallele Ticks senden nie doppelt.
- Partner-Nachrichten gehen sofort nach der Aktion raus (`after()`), unabhängig von der Ruhezeit,
  weil die andere Person ja gerade selbst aktiv ist.

### Rückblick in Kürze

- Nach dem Date (Status „stattgefunden“) vergibt jede Person **1–5 Herzen** und optional eine
  Notiz (`date_reviews`, eine Zeile pro Person und Date, später änderbar).
- **Verdeckt:** Die Herzen der anderen Person sieht man erst, wenn man selbst bewertet hat –
  damit sich niemand nach dem anderen richtet (`visibleReviews()` in `src/core/reviews.ts`).
- **Erinnerung** „Wie war's?“ am Tag nach dem Date um 11 Uhr, nur an alle, die noch nicht bewertet haben;
  die Startseite fragt außerdem 14 Tage lang nach. Die erste Bewertung meldet sich bei der
  anderen Person.
- **„Unsere Dates“** (`/dates`): alle Dates mit Herzen, Zahlen (Anzahl, Ø Herzen, dieses Jahr)
  und Lieblingsdate. Die Einstellungen sind dafür aus der unteren Leiste in den Kopf der
  Startseite gewandert (Regler-Symbol).

### KI-Vorschläge in Kürze

- **„✨ Ideen von der KI“** auf der Planen-Seite (kennt den gewählten Termin und die Größe;
  „Nehmen“ wählt die Idee direkt aus) und als „✨ KI-Ideen“ auf der Wunschliste.
- Ihr wählt Budget, Stimmung und drinnen/draußen; **Claude Haiku 5.5** liefert per
  Structured Output drei Ideen (`src/server/ai-ideas.ts`, Prompt und Prüfung in
  `src/core/ai-ideas.ts`, mit Tests).
- **Wetter** für den Termin kommt von Open-Meteo (kostenlos, ohne Schlüssel, bis ~14 Tage
  voraus, `src/server/weather.ts`); ohne Termin oder bei Fehlern heißt es „unbekannt“.
- **An Claude geht nur:** Termin (Tag, Uhrzeit, Dauer), Wetter, eure Auswahl, die Titel der
  Wunschliste und Titel + Ø Herzen vergangener Dates. Keine Namen, Mails, Notizen, Kalender.
- **Grenze:** 20 Vorschlags-Runden pro Tag und Paar. Jeder Claude-Aufruf (auch für die
  Event-Quellen) landet mit Tokenzahlen in `ai_requests`.
- Gemerkte Vorschläge stehen mit `source = 'ai'` auf der Wunschliste.

### Köln-Ideen & „Überrasch uns“ in Kürze

- **Köln-Ideen** (`/ideas/koeln`, Tab neben Wunschliste und „Was läuft“): 40 handverlesene Ideen
  in `src/core/curated-ideas.ts` (feste IDs, grobe Kosten für zwei, drinnen/draußen), filterbar
  nach Ort, Budget und Größe. „Auf die Wunschliste“ legt eine Idee mit `source = 'curated'`
  und `external_ref = <id>` an. Neue Ideen: einfach einen Eintrag in der Datei ergänzen.
- **„Überrasch uns“** (Startseite neben „Date planen“, Wunschliste, Köln-Tab): zieht zufällig
  aus Wunschliste (doppelt gewichtet) und noch nicht gemerkten Köln-Ideen, ohne die letzten
  Ziehungen zu wiederholen (`pickSurprise()` in `src/core/surprise.ts`, mit Tests).
  „Damit planen“ öffnet `/plan?idea=…` mit der Idee vorausgewählt; eine Köln-Idee kommt dafür
  vorher auf die Wunschliste.
- Der Vorschlag-Modus nutzt weiterhin nur die Wunschliste – was ihr euch selbst ausgesucht habt.

### Fotos in Kürze

- Auf der Seite eines vergangenen Dates: **📷 Fotos hinzufügen** (mehrere auf einmal, bis 24).
- Der Browser verkleinert jedes Foto vor dem Hochladen (`src/lib/resize-image.ts`): 1600 px
  plus 480-px-Vorschau als JPEG. Dabei fallen EXIF-Daten wie der GPS-Ort weg.
- Der Server prüft die echten Bytes (`sniffImageType()`), nicht den Dateinamen, und legt die
  Dateien in einem **privaten Vercel Blob Store** ab, unter zufälligen Namen pro Paar.
- Ausgeliefert wird nur über `/api/photos/[id]` – mit Login- und Paar-Prüfung; der Browser darf
  die Bilder privat cachen. Antippen öffnet die Großansicht mit Blättern und Löschen.
- Das erste Foto ist das Titelbild auf „Unsere Dates“.
- Lokal (mit `ENABLE_DEV_TOOLS=1` ohne Blob-Token) landen Fotos in `.data/photos`
  (`src/server/photos/store.ts`).

### Event-Quellen in Kürze

- In den **Einstellungen → Event-Quellen** tragt ihr Seiten ein (Veranstaltungskalender oder
  Tipps-/Magazinseite). Ein Knopf fügt die vier Köln-Quellen auf einmal hinzu.
- **Lesen** (`src/server/events/`): Der Server holt die Seite selbst (`fetch-page.ts`). Stehen
  genug Events als schema.org-JSON-LD drin, werden nur die genommen – exakt und ohne KI.
  Sonst wird die Seite zu Text mit `[Link](url)` gekürzt (`htmlToText`) und **Claude Haiku 5.5**
  füllt per Structured Output eine feste Liste (Titel, Zeit, Ort, Preis, Link, Kurztext).
- **Prüfen** (`cleanItems()` in `src/core/events.ts`, mit Tests): Vergangenes und mehr als
  60 Tage Entferntes fliegt raus, Links zu fremden Domains werden verworfen, Doppelte entfernt.
- **Wann:** Der Cron-Tick liest ab 5 Uhr pro Lauf höchstens eine Quelle, die älter als 20 Std.
  ist – nach der Antwort an cron-job.org (`after()`). „Jetzt lesen“ geht jederzeit.
- **„Was läuft“** (`/events`, Tab neben der Wunschliste): Events der nächsten drei Wochen nach
  Tagen, mit „✓ Ihr habt beide Zeit“ (eine FreeBusy-Abfrage pro Person, inkl. Puffer).
  „Als Date planen“ legt das Date direkt zur Event-Zeit an (mit Google-Einladung),
  „Merken“ setzt es auf die Wunschliste (`ideas.source = 'web'`).
- **Ohne `ANTHROPIC_API_KEY`** werden nur JSON-LD-Seiten gelesen; die Einstellungen sagen das.

### Slot-Finder in Kürze

1. FreeBusy für beide Personen und alle ausgewählten Kalender (nur Belegt-Zeiten, nichts wird gespeichert).
2. Puffer um jeden Termin legen, alles vereinigen.
3. Pro Tag im Zeitfenster (z. B. Start 10–21 Uhr, Ende spätestens 23 Uhr) die Lücken bestimmen,
   Startzeiten im 30-Minuten-Raster prüfen.
4. Jeden Kandidaten bewerten (`scoreSlot`): klein → Abende und Wochenend-Nachmittage,
   groß → Wochenende und viel Zeit am Stück; früher ist leicht besser, etwas Luft drumherum auch.
5. Bester Slot pro Tag, davon die fünf besten. Platz 1 ist der „Top-Tipp“.

## Datenmodell

| Tabelle | Zweck |
|---|---|
| `couples`, `users`, `sessions` | Paar, zwei Personen, Login-Sitzungen (nur Token-Hash) |
| `google_connections` | verschlüsselte Google-Tokens, gewählte Kalender |
| `couple_settings` | Rhythmus, Modus, Zeitfenster, Puffer … |
| `ideas` | Wunschliste |
| `cycles`, `date_plans`, `suggestions` | Runden, geplante Dates, App-Vorschläge |
| `date_reviews` | Herzen + Notiz je Person und Date |
| `date_photos` | Fotos je Date (nur Pfade; die Dateien liegen im privaten Blob Store) |
| `ai_requests` | jeder Claude-Aufruf mit Tokenzahlen (Tageslimit, Kostenüberblick) |
| `event_sources`, `events` | gefolgte Seiten (mit Abruf-Status) und was dort gefunden wurde |
| `push_subscriptions`, `notification_prefs`, `notification_log` | Push |

`ideas.source`/`external_ref`: Herkunft einer Idee (`curated` = Köln-Idee, `web` = gemerkt aus „Was läuft“, `ai` = KI-Vorschlag).

## Entwickeln

```bash
npm install
cp .env.example .env.local   # ausfüllen, siehe docs/SETUP.md
npm run db:migrate
npm run dev
```

| Script | |
|---|---|
| `npm run dev` | Entwicklungsserver auf http://localhost:3000 |
| `npm test` | Unit-Tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:generate` | Migration aus geändertem `schema.ts` erzeugen |
| `npm run db:migrate` | Migrationen anwenden (läuft auch automatisch vor jedem Build) |
| `npm run gen:keys` | neue Secrets erzeugen |

Schema ändern: `src/server/db/schema.ts` anpassen → `npm run db:generate` → die erzeugte
SQL-Datei committen. Vercel wendet sie beim nächsten Deploy an.

## Erweiterungen (nach V1)

Bewusst nicht in V1, aber vorbereitet:

| Idee | So würde man sie andocken |
|---|---|
| **Neue Erinnerung** | Typ in `NOTIFICATION_TYPES` (`src/lib/domain.ts`) ergänzen, Zeitpunkt in `plannedReminders()` (`src/core/reminders.ts`, mit Test), Text in `reminderText()` (`src/server/notifications.ts`), Beschriftung in `push-settings.tsx`. Keine Migration nötig. |
| **Weitere Person / Gruppen** | Bewusst nicht vorgesehen: Runden, Bestätigen und Push gehen überall von genau zwei Personen aus. |

## Sicherheit & Datenschutz

- **KI:** An Claude gehen nur Termin, Wetter, Auswahl und Titel (Wunschliste, vergangene Dates
  mit Ø Herzen) – keine Namen, Mails, Notizen oder Kalenderdaten. 20 Runden pro Tag.
- **Fotos:** privater Blob Store, Auslieferung nur nach Login- und Paar-Prüfung, eigene
  strenge CSP für die Bild-Route, Dateityp anhand der Bytes geprüft, EXIF wird entfernt.
- **Event-Quellen:** Der Server ruft nur öffentliche `https`-Adressen ab (keine IPs, keine
  internen Namen); jede Weiterleitung und die DNS-Auflösung werden erneut geprüft, private
  Netze sind gesperrt (`src/lib/url-safety.ts`). Seiten werden auf 3 MB und 15 s begrenzt.
  Seiteninhalt gilt als fremd: Claude füllt nur ein festes JSON-Schema, alles wird danach
  nochmal geprüft, Links müssen zur Quelle gehören. An Claude geht nur der Seitentext –
  keine Namen, Kalender oder Notizen von euch. Restrisiko: DNS-Rebinding zwischen Prüfung und
  Abruf; da nur ihr zwei Quellen eintragen könnt, ist das bewusst in Kauf genommen.

- Login nur für Adressen in `ALLOWED_EMAILS`. Danach gilt die Kopplung per Einladungscode;
  sind zwei Personen drin, wird der Code gelöscht.
- Sessions: zufälliges Token im httpOnly-Cookie, in der DB nur dessen SHA-256-Hash.
- Google-Tokens werden AES-256-GCM-verschlüsselt gespeichert (`TOKEN_ENCRYPTION_KEY`).
- Aus den Kalendern liest die App nur Belegt-Zeiten (FreeBusy) und speichert keine Termindetails.
- Alle Secrets liegen nur in Umgebungsvariablen (`.env.example` als Vorlage).
- `/api/cron/tick` verlangt `Authorization: Bearer <CRON_SECRET>` (zeitkonstanter Vergleich).
- Wer aus `ALLOWED_EMAILS` entfernt wird, ist sofort abgemeldet (Prüfung bei jedem Seitenaufruf).
- Fehler von Google-OAuth werden nur gekürzt geloggt (Fehlercode + HTTP-Status), weil die
  Original-Fehler Refresh-Tokens und Auth-Codes enthalten (`src/lib/safe-error.ts`).
- Push-Abos werden nur für die Push-Dienste der Browser angenommen (Google, Apple, Mozilla,
  Microsoft), damit der Server keine beliebigen Adressen anfragt.
- Sicherheits-Header (`next.config.ts`): kein Einbetten in fremde Seiten, `nosniff`,
  sparsamer Referrer. Abgelaufene Sessions löscht der Cron-Tick.
