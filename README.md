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
| M13 | Verständlich & aufgeräumt: Einführung, Start-Checkliste, „Dein nächster Schritt“, ⓘ-Hilfen, Ideen beim Planen gebündelt, Schnell planen | ✅ |
| M14 | Tests + CI im Repo: End-to-End-Suites mit Mocks, GitHub Actions | ✅ |
| M15 | Link → Idee: TikTok/Instagram/YouTube/Webseite teilen oder einfügen, Claude macht eine Idee draus | ✅ |
| M16 | „Läuft alles?“: Status in den Einstellungen, Warnung bei stehender Automatik, Push bei getrenntem Kalender | ✅ |
| M17 | Entdecken: KI-Ideen-Stapel zum Swipen, Match nur wenn beide 💚, Rückgängig, Super-Like, Event-Kombis | ✅ |
| M18 | Budget & Spartopf: Monatsbudget, echte Kosten im Rückblick, Spartopf, Monatsrückblick | ✅ |
| M19 | Besondere Tage (Jahrestag, Geburtstage) mit Erinnerung, „Vielleicht“-Stapel, alte Ideen auffrischen | ✅ |
| M20 | Eure Date-Story: Jahresrückblick zum Durchtippen, Swipe-Statistik „Euer Ding“ | ✅ |
| M21 | Extras: Überraschungs-Date, Vorbereitungs-Checkliste, Route (ÖPNV), Gesprächskarten, iPhone-Teilen per Kurzbefehl | ✅ |
| M22 | Aufgeräumt: ein Filter für alles, 3 Ideen-Reiter, Planen ohne Reiter, Extras nach und nach, Kontrast im dunklen Modus | ✅ |
| M23 | Event-Quellen mit Unterseiten: KI sucht bis zu 6 Veranstaltungs-Seiten aus, ihr könnt welche entfernen oder hinzufügen | ✅ |
| M24 | Navigation in der Reihenfolge eines Dates: Ideen · Date planen (Mitte) · Dates – die Startseite ist darin aufgegangen | ✅ |
| M25 | Idee antippen → „Date damit planen“ oder „Statt … machen“ (nach Rückfrage, Termin bleibt); ein 💚 beim Swipen landet gleich auf der Wunschliste | ✅ |
| M26 | Ein Ablauf statt Reitern: der Start zeigt, was ansteht, darunter Idee → Zeit → fertig; Ideen, Dates und Einstellungen als Icons oben | ✅ |
| M27 | Ohne Scrollen: jeder Bildschirm passt, man klickt sich durch (Zeiten blättern, Einstellungs-Themen, Historie in Seiten, Reiter) | ✅ |
| M28 | Feinschliff: schneller Start (Zeiten erst bei Bedarf), Zeiten nach Datum, kompakte Rundenkarte, eine Ideen-Karte, einfachere Begriffe, gruppierte Einstellungen | ✅ |
| M29 | Design (Richtung A): Schatten nur für Aktionen, Farbrollen, Schritt-Punkte, Icons, Maskottchen, Fotoraster, ruhige Kopfzeile, Daumenzone | ✅ |
| M30 | Eine Wunschliste, wo sie passt: Schritt 1 = Wunschliste, „Solange swipen?“ auf dem Start, „Nächstes Mal?“ nach dem Bewerten, 💡 mit zwei Reitern | ✅ |
| M31 | Start = ein Kasten + Swipen: im Kasten „Date planen“, „Passt!“, der Vorschlag oder das Date; darunter die Swipe-Karte; „Date planen“ führt zur Wunschliste | ✅ |
| M32 | Kopfzeile mit 💡 ♥ ⚙️ rechts, die Seiten klappen von oben herunter (gleiches Icon = wieder hoch); Swipe-Karte mit Knöpfen auf der Karte, ohne Vielleicht/Super-Like | ✅ |
| M33 | Erinnerungen sind Pflicht: letzte Einführungskarte schaltet Push an, auf dem Start eine Zeile mit Ein-Tipp-Aktivierung, Hinweis wenn die andere Person keine bekommt, Hilfe bei verweigerter Erlaubnis | ✅ |
| M34 | Der Start zeigt, was ansteht: der Kasten bekommt den Platz, Swipen wird eine Zeile; „Wie war's?“ mit Foto und antippbaren Herzen | ✅ |
| M35 | Der Top-Tipp passt zur Idee: Tageslicht (Sonnenuntergang) und Wetter für Draußen-Ideen, Begründung an der Zeit, `ideas.setting` | ✅ |
| M36 | Swipen, das man sieht: Kategorien als Chips über der Wunschliste, Herkunft („von dir geswipt“), Fortschritt, Stapel, Flug zum 💡 mit wachsendem Zähler, `ideas.category` | ✅ |
| M37 | Untere Leiste: das Logo groß in der Mitte (startet „Date planen“), links 💡 Ideen, rechts ♥ Dates; oben nur Name und Einstellungen, die Seiten klappen nicht mehr herunter | ✅ |
| M38 | Der Start ist nie leer: steht etwas an, bekommt die Swipe-Karte trotzdem den Rest des Bildschirms; nur bei zu wenig Platz bleibt die eine Zeile | ✅ |

## Tech-Stack

| | |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4, Design-Tokens in `src/app/globals.css` |
| Datenbank | Postgres (Neon), Drizzle ORM, Migrationen in `drizzle/` |
| Hosting | Vercel (Region Frankfurt) |
| Auth | eigener Google-OAuth-Flow (PKCE) mit `google-auth-library`, DB-Sessions |
| Tests | Vitest (Logik), Playwright-End-to-End mit Mock-Servern (`e2e/`), GitHub Actions |

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
- **Vorschlag:** Pro Runde gibt es einen gemeinsamen Vorschlag: die Idee, die am längsten auf der
  Wunschliste wartet (jede zweite Runde bevorzugt groß), mit dem besten freien Slot *für diese
  Idee* (Draußen-Ideen: Tageslicht und Wetter, M35).
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
  In Safari zeigen Einführung, Startseite und Einstellungen deshalb eine Schritt-für-Schritt-Anleitung.
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

### Bedienung in Kürze (M13)

- **Einführung** (`/welcome`): fünf Karten nach dem Koppeln (die letzte schaltet die Erinnerungen an, M33) (Rhythmus/Modus und Namen
  eingesetzt), danach nie wieder automatisch – `users.onboarded_at`. In den Einstellungen
  unter „Hilfe“ jederzeit erneut.
- **Startseite:** oben genau eine Karte „Dein nächster Schritt“ (`nextStep()` in
  `src/core/next-step.ts`, mit Tests): Kalender verbinden → „Passt!“ geben → planen →
  bewerten → sonst „Stand der Dinge“. Seit M31 steckt das nächste Date mit im Kasten, darunter
  kommen die Erinnerungs-Zeile (M33), eine **Start-Checkliste** (Kalender, Home-Bildschirm;
  verschwindet, wenn alles erledigt ist) und das Swipen (groß oder eine Zeile, M34).
- **ⓘ-Hilfen:** `<Info term="…">` mit Texten aus `src/lib/glossary.ts`, über die Popover-API
  des Browsers (kein eigenes JavaScript).
- **Planen:** „Was wollt ihr machen?“ mit der Wunschliste (seit M30 ohne „Schnell planen“), „🎲 Zufall“, „Was anderes …“ und die eigene Idee (M22).
  Was man nimmt, landet auf der Wunschliste und ist sofort gewählt.
- **Wörter:** Kurz/Lang statt Klein/Groß, „Diese Woche“ statt „Runde 3“, „Plan bis …“ statt
  „Deadline“. Einstellungen: „Das Wichtigste“ oben, der Rest eingeklappt (M22).

### Erinnerungen in Kürze (M33)

- **Einführung:** Die letzte Karte schaltet Push mit einem Tipp an (`usePush()` in
  `src/components/use-push.ts`, dieselbe Logik wie in den Einstellungen); auf dem iPhone in Safari
  steht dort die Anleitung für den Home-Bildschirm. „Später“ ist klein, der große Knopf kommt mit Push.
- **Start:** Solange ich kein Gerät angemeldet habe, steht eine Zeile mit „Aktivieren“ da – nicht
  wegklickbar. Hat die andere Person keins, sagt eine leise Zeile „Sam bekommt keine Erinnerungen –
  sag Bescheid“ (eine Woche ausblendbar). Welche Zeile gilt, entscheidet `pushRow()` in
  `src/core/push-nudge.ts`.
- **Verweigert:** Der Start, die Einführung und die Einstellungen zeigen, wie man die Erlaubnis
  wieder gibt (iPhone, Android, Computer – `deniedHelp()`).

### Start: Platz für das, was ansteht (M34)

- `deckSize()` in `src/core/start-layout.ts` entscheidet pro Zustand: Steht etwas an (Passt! geben
  oder abwarten, ein Date in dieser Runde, ein Date zu bewerten, ein offener Vorschlag, ein Kalender
  zu verbinden), steht der Kasten oben. Seit M38 bekommt die Swipe-Karte darunter den Rest des
  Bildschirms (CSS-Container-Query `.deck-fit` in `globals.css`); nur wenn weniger als 15 rem übrig
  sind, bleibt eine Zeile („6 neue Ideen zum Swipen ›“). Wenn nichts ansteht, ist die Karte groß.
- **„Wie war's?“** zeigt Titel, Datum, das erste Foto und fünf Herzen; ein Tipp auf ein Herz öffnet die
  Bewertung mit dieser Zahl (`/dates/<id>?herzen=n`). Steht ein anderer Schritt oben, bekommt die
  Bewertung eine eigene Karte.

### Zeiten passend zur Idee (M35)

- Der Slot-Finder kennt jetzt Tageslicht und Wetter (siehe „Slot-Finder in Kürze“, Punkt 6). Der
  Ablauf wählt die Rangfolge nach der gewählten Idee; der Vorschlag-Modus nimmt zuerst die Idee und
  dann die Zeit, die zu ihr passt.
- Neu am Datenmodell: `ideas.setting` (drinnen / draußen, leer = egal).

### Swipen, das man sieht: Kategorien und Likes (M36)

- **Kategorien** (`src/core/categories.ts`): Essen & Trinken, Natur, Kultur, Aktiv, Kreativ, Gemütlich,
  Ausflug, Events, Sonstiges. `ideas.category` ist optional; fehlt sie, schließt `categoryOf()` aus
  Titel und Notiz (Stichwörter mit Wortgrenzen). Swipe-Karten übernehmen ihr Thema, im Idee-Formular
  gibt es „Wo?“ und „Was für ein Date?“ in den Details.
- **Chips über der Wunschliste:** Alle · Matches · Geswipt · die Kategorien, die vorkommen (mit Zahl).
  Die Kategorie steckt im gemeinsamen Filter (`IdeaFilter.category`) und gilt damit auch in der
  Planungsliste; Matches und Geswipt sind nur Ansichten der Liste (`/ideas?ansicht=geswipt|match`).
- **Geswipt bleibt sichtbar:** Karten der Wunschliste tragen die Kategorie und ihre Herkunft („💚 von
  dir geswipt“, „💚 Sam hat's geliked“, „💞 Match“). Die Swipe-Seite verlinkt „💚 Meine Likes“.
- **Gefühl:** ein Like lässt ein 💚 zum 💡 fliegen (der Zähler am 💡 springt hoch, Android vibriert,
  `prefers-reduced-motion` schaltet es ab); dahinter liegen zwei weitere Karten als Stapel; die
  Swipe-Seite zeigt „3 geswipt · 2 💚 · 5 übrig“. Der Zähler am 💡 ist die Zahl der Wunschlisten-Ideen
  (Server) plus das, was seit dem letzten Laden geliked wurde.

### Start in Kürze (M31)

- **Ein Kasten oben:** Er sagt, wer dran ist, und hat genau das drin, was zu tun ist – „Date planen“,
  „Passt! 💚“, „Jetzt bewerten“, den Vorschlag (Vorschlag-Modus) oder das nächste Date mit Ort,
  Route, „Details ›“ (Checkliste, Zeit ändern, Absagen) und „Lieber was anderes?“.
- **Darunter swipen:** Die Swipe-Karte liegt direkt auf dem Start (`SwipeDeck compact`) – 💚 legt
  die Idee auf die Wunschliste, beide 💚 = Match. Das Badge „x ›“ öffnet den ganzen Stapel mit
  Filter. Werden die Karten knapp, mischt der Start im Hintergrund neue. Seit M34 gilt das nur,
  wenn nichts ansteht – sonst ist Swipen eine Zeile (siehe unten).
- **Durchklicken:** „Date planen“ (`/plan?pick=1`) zeigt die Wunschliste als eigenen Schritt mit
  „← Zurück“, danach die Zeit. Unten nur noch „Zufall“ und „Was anderes“.
- **💡** ist die Wunschliste zum Sammeln und Bearbeiten, ohne Reiter.

### Ideen in Kürze (M30)

- **Eine Wunschliste:** Schritt 1 beim Planen ist die Wunschliste. „+ Idee“ steht direkt dort,
  ⋯ an jeder Karte bearbeitet oder löscht, Antippen plant. 💡 oben zeigt dieselbe Liste zum Sammeln.
- **Ideen, wenn ihr Zeit dafür habt:** Ist der/die andere dran, liegt die große Swipe-Karte auf dem
  Start; steht etwas an (Date, Passt!, Bewerten, Vorschlag), ist Swipen eine Zeile (M34).
- **Nach dem Bewerten:** „Nächstes Mal?“ mit den drei Ideen, die am längsten warten – ein Tipp plant.
- **💡 ist die Wunschliste** (seit M31 ohne Reiter, Swipen liegt auf dem Start). „Was läuft“ steckt in „Was anderes …“ beim Planen
  (Events, bei denen ihr beide Zeit habt, plus „Alles, was in Köln läuft →“) und im Swipe-Stapel.
- **Ruhiger Start:** „Schnell planen“ ist weg – Schritt 1 beginnt direkt mit der Wunschliste. Ist die
  letzte Runde ausgefallen, steht das in derselben Farbbox wie „Du bist dran!“ (`NextStepCard note`).

### Design in Kürze (M29, Richtung A)

- **Sticker nur für das, was man antippen soll:** Hauptknöpfe und das nächste Date haben Rand und
  harten Schatten. Listen, Infos und Nebenknöpfe sind flach (`flat`, gibt beim Tippen leicht nach).
- **Farben mit Aufgabe:** Pink = machen, eure Farben = wer dran ist, Minze = steht, Gelb = Hinweis
  oder Warnung, sonst neutral. Die Kurz/Lang-Chips sind neutral mit Icon.
- **Schritte als Punkte** (● ○) statt „Schritt 1 von 2“; der nächste Schritt schiebt sich von rechts
  herein. Kleine Labels ohne Großbuchstaben.
- **Icons statt Emoji** in der Bedienung (`components/icons.tsx`): Zufall, Was anderes, Swipen, Ort,
  Datum, Einstellungs-Kacheln, Ideen-Menü. Emoji bleiben beim Inhalt.
- **Maskottchen:** Die Kaugummi-Maschine kurbelt, während die Zeiten laden, und steht in leeren
  Zuständen (Wunschliste, Dates, keine Lücke).
- **Historie als Fotoraster** (2 × 2 pro Seite), ohne Foto mit der Maschine.
- **Ruhige Kopfzeile auf Unterseiten:** nur die kleine Maschine mit „← Date planen“.
- **Daumenzone:** „Passt! 💚“ und „Lieber was anderes machen?“ stehen unten auf dem Start.
- **Das Date steht ganz auf dem Start** (kompakte `DateCard`): Ort mit Route, Notiz, Vorbereitung
  (zugeklappt), am Tag die Gesprächskarten, „Zeit ändern“ und „Absagen“ – ohne Umweg über eine
  eigene Seite. `/dates/[id]` zeigt kommende Dates weiterhin (für Push-Links).

### Feinschliff in Kürze (M28)

- **Schneller Start:** Der Start fragt Google nicht mehr. Die freien Zeiten lädt der Ablauf selbst
  (`freeTimesAction` in `plan/actions.ts`), und zwar im Hintergrund, frisch beim Öffnen von
  Schritt 2, wenn sie älter als eine Minute sind. Das Neuladen alle 15 Sekunden kostet keine
  Google-Abfrage mehr.
- **Zeiten:** zuerst der Top-Tipp, danach nach Datum (`orderSlots()` in `src/core/slots.ts`).
- **Rundenkarte:** eine Zeile „Diese Woche · Plan bis Do 20 Uhr · noch 2 Tage“, ein einziges ⓘ.
- **Eine Ideen-Karte** (`components/idea-card.tsx`) für Wunschliste und Planen, mit 💞 Match,
  wer sie eingetragen hat und ⚠️ über Budget.
- **Begriffe:** im Alltag „diesmal“ und „Plan bis“, „Runde“ nur noch in Einstellungen und Historie.
- **Einstellungen:** „Für euch beide“ und „Nur für dich“. „Läuft alles?“ steht nur oben, wenn
  etwas nicht stimmt, sonst ist es ein Link unten.
- **Pushes** führen direkt zum Ziel (`/plan`, `/dates/…`), ohne Umleitung.

### Ohne Scrollen in Kürze (M27)

- **Jeder Bildschirm passt auf einen Bildschirm** (`main[data-screen]` ist so hoch wie das Display).
  Gescrollt wird nur in Listen: Wunschliste, „Was läuft“, Listen in Sheets und lange
  Einstellungs-Themen (Event-Quellen, Freie Zeiten). Passt es auf einem kleinen Handy doch nicht,
  scrollt die Seite als Notlösung; die e2e-Tests prüfen das mit `fitsScreen()` (390×844).
- **Start:** der Stand in kurz und das nächste Date als Zusammenfassung mit „Passt!“. Checkliste,
  Route, Gesprächskarten, Ändern und Absagen liegen auf der Seite des Dates (`/dates/[id]`).
  „Startklar“ ist eine Zeile, „›“ zeigt den nächsten Punkt (Erinnerungen haben seit M33 eine eigene Zeile).
- **Schritt 1:** Nur die Wunschliste scrollt. Unten stehen 🎲 Zufall · Was anderes …;
  die eigene Idee (mit Ort) steht in „Was anderes …“.
- **Schritt 2:** drei Zeiten, „Weitere Zeiten →“ blättert; Länge als kleiner Schalter.
- **Einstellungen:** eine Übersicht mit Kacheln, jedes Thema eine eigene Seite (`/settings?t=budget`,
  alte `#budget`-Links werden umgeleitet).
- **Eure Dates:** 4 pro Seite mit „← Neuere / Ältere →“. Ein vergangenes Date hat Reiter
  (Bewerten · Fotos · Partner:in), das Budget Reiter für diesen und frühere Monate.

### Ein Ablauf in Kürze (M26, löst die Navigation von M24 ab)

- **Untere Leiste (seit M37, vorher Icons oben):** `BottomNav` im Layout von `(app)`. Links 💡 Ideen
  (die Wunschliste; mit Zähler; Swipen liegt auf dem Start), in der Mitte das große Logo: auf anderen Seiten
  zurück zum Start, auf dem Start selbst klappt es drei runde Aktionen auf (Date planen · Idee ·
  Was läuft; `LogoButton` in `bottom-nav.tsx`, das Idee-Formular öffnet per Fenster-Event), rechts ♥ Dates (Kommendes und Historie). Oben stehen nur der Name (führt zum
  Start), ⚙️ Einstellungen und – wo es passt – „+ Idee“. Die Seiten öffnen normal; das Herunterklappen
  von M32 gibt es nicht mehr.
- **Start = was gerade ansteht** (`StartSection` in `src/app/(app)/overview.tsx`): das nächste Date
  mit „Passt!“, „Wie war's?“, der Stand der Runde, die Start-Checkliste.
- **Steht nichts an:** darunter der Ablauf (`PlanFlow` in `plan/plan-form.tsx`):
  1. **Was wollt ihr machen?** Wunschliste antippen, oder 🎲 Zufall, „Was anderes …“ (Events,
     Köln, KI), 💞 Neue Ideen swipen oder die eigene Idee.
  2. **Wann?** Die Länge kommt von der Idee (umstellbar), dazu die freien Zeiten, Überraschung,
     Spartopf und das Budget.
  3. **Date festlegen 🎉:** Konfetti, danach zeigt der Start das Date.
- **Steht das Date der Runde:** „🔄 Lieber was anderes machen?“ öffnet Schritt 1. Eine angetippte
  Idee ersetzt nach der Rückfrage die des Dates, der Termin bleibt (wie in M25). „Ändern“ an der
  Date-Karte ändert nur die Zeit (`/plan?reschedule=…`).
- **Eure Dates** (`/dates`) ist nur noch die Historie: Runden, bisherige Dates, Statistik, Story.
- KI-Ideen planen für den nächsten freien Termin (Top-Tipp), damit Wetter und Länge passen.

### Ideen antippen in Kürze (M25)

- **Tippen auf eine Idee** der Wunschliste öffnet ein kleines Menü: „📅 Date damit planen“ (öffnet
  „Date planen“ mit der Idee) und „✏️ Bearbeiten“.
- **Steht schon ein Date an**, heißt der erste Knopf „🔄 Statt „…“ machen“. Davor kommt die Frage
  „Willst du das ändern?“ mit dem jetzigen Date. Mit „Ja, ändern“ bleibt der Termin, nur die Idee
  (Titel, Ort, Notiz, Kosten) wechselt (`swapDateIdea()` in `src/server/dates.ts`). Ein „Passt!“
  bleibt bestehen, der Google-Termin wird angepasst, und der/die andere bekommt einen Push.
- Die Überraschung des anderen kann man so nicht ändern, und sie wird auf der Wunschliste auch
  nicht markiert. Die eigene Überraschung bleibt beim Tauschen geheim (kein Push).
- Auf der Karte stehen „📅 Nächstes Date“ und „💞 Match“ (wenn ihr beide nach rechts gewischt habt).

### Aufgeräumt in Kürze (M22)

- **Ein Filter für alles** (`src/core/filters.ts`, mit Tests; Knopf + Sheet in
  `src/components/idea-filter.tsx`): drei Fragen – Wie lang? Was darf es kosten (Gratis / bis
  20 €)? Drinnen oder draußen? Gilt gleichzeitig für Wunschliste, Swipen, „Was läuft“ und die
  Ideen beim Planen und bleibt pro Gerät gespeichert (`localStorage`). Unbekanntes passt immer
  (ein Event hat keine Dauer), außer bei „Gratis“. „Mehr … holen“ im Stapel bittet Claude um
  passende Karten.
- **Ideen = 3 Reiter:** 💡 Wunschliste · 💞 Swipen · 🎟️ Was läuft. Die Köln-Ideen sind kein
  eigener Reiter mehr: Jede Ladung im Stapel bringt drei davon mit (📍), auch ohne KI oder wenn
  die KI ausfällt (`curatedForDeck()`); `/ideas/koeln` leitet zum Stapel um. Die KI-Ideen mit
  eigenen Chips (Budget, Stimmung, Ort) sind weg – die KI steckt im Stapel und beim Planen.
- **Planen ohne Reiter:** „Von eurer Wunschliste“ (mit Filter), daneben „🎲 Zufall“ und
  „Was anderes …“ – ein Sheet mit Suche über Events (beide frei), Köln-Ideen und
  „✨ 3 Ideen von der KI“. Darunter ein Feld für die eigene Idee.
- **Extras nach und nach:** Überraschungs-Date erst ab dem ersten Date, Date-Story-Link ab drei
  Dates, Budget auf der Startseite nur wenn es knapp wird. Unter Einstellungen → ✨ Extras lassen
  sich Überraschung, Checkliste, Gesprächskarten und Story für beide abschalten
  (`couple_settings.hidden_extras`).
- **Startseite:** nächster Schritt, nächstes Date, höchstens zwei Hinweise und Start-Checkliste
  (seit M24 auf „Date planen“ und „Dates“ verteilt). „Eure letzten Runden“ steht unter Dates.
- **Einstellungen:** „Das Wichtigste“ (Kalender, Rhythmus, Erinnerungen – die einzelnen
  Erinnerungen eingeklappt) und „Mehr einstellen“ mit eingeklappten Bereichen. Links wie
  `/settings#budget` klappen den passenden Bereich auf (`fold.tsx`).
- **Kontrast:** Helle Flächen (`bg-zitrone-soft`, `bg-himbeere` …) bleiben im dunklen Modus hell
  – in `globals.css` bekommen sie dort die hellen Farb-Tokens, damit Schrift darauf dunkel
  bleibt. m13 misst das Kontrastverhältnis der Einführung im dunklen Modus (vorher 1,1 : 1).

### Entdecken (Swipen) in Kürze

- **Stapel:** Claude Haiku 5.5 macht Ideen in Ladungen à 20 (`src/server/deck.ts`, Prompt und
  Prüfung in `src/core/deck.ts`, mit Tests). Sinkt der Stapel bei einem von euch unter 5 Karten,
  kommt im Hintergrund die nächste Ladung (beim Öffnen der Seite, nach einem Swipe oder im
  Cron-Tick) – höchstens 3 automatisch pro Tag, insgesamt 6 Ladungen pro Tag und Paar.
- **Nichts doppelt:** Jede Karte bekommt einen Schlüssel aus ihren Kernwörtern (eindeutig pro
  Paar, Karten werden nie gelöscht). Claude bekommt alle bisherigen Titel, Wunschliste und
  vergangene Dates als Ausschlussliste; was trotzdem fast gleich klingt
  („Stadtwald-Picknick“ ≈ „Picknick im Stadtwald“), wird verworfen.
- **Abwechslung:** Jede Ladung hat vier andere Schwerpunkte aus zwölf (Essen, Natur, Kultur,
  Ausflug …), kennt Jahreszeit und Wetter der nächsten Tage, und etwa jede vierte Idee ist
  bewusst „🎲 mal was anderes“. Gemochtes und Weggewischtes fließt als Geschmack ein.
- **Event-Kombis:** echte Events aus euren Event-Quellen (nächste 14 Tage) plus etwas Passendes
  davor/danach, mit „✓ Ihr habt beide Zeit“. Anteil in den Einstellungen: Keine / Ein paar /
  Viele. Kombi-Karten verschwinden, wenn das Event begonnen hat.
- **Swipen:** rechts/💚 = gerne, links/✕ = nö, ↩️ nimmt den letzten Swipe zurück – beliebig oft
  hintereinander (Super-Like und „Vielleicht“ gibt es seit M32 nicht mehr in der Oberfläche).
  Tastatur: ← → und Rücktaste. Es gilt der gemeinsame Filter (M22);
  „Mehr … holen“ macht gezielt passende Karten.
- **Match:** Jede:r swipet für sich. Seit M25 kommt schon ein einzelnes 💚 auf die Wunschliste
  (`source = 'deck'`, mit deinem Avatar); die Karte bleibt im Stapel des anderen. Gibt der/die
  andere auch 💚: „Match! 💞“ mit Konfetti, Push an beide, „📅 Jetzt planen“ und auf der
  Wunschliste das Abzeichen „💞 Match“. Ein ✕ zuerst nimmt die Karte für beide aus dem Stapel.
  Rückgängig nimmt dein 💚 wieder von der Liste, solange es das einzige war (außer die Idee ist
  schon als Date geplant); ein Match zurücknehmen lässt das 💚 des anderen stehen.
- **Nachrichten** (einzeln abschaltbar unter Erinnerungen): „Match!“, „⭐ … findet etwas super“
  und höchstens einmal am Tag „Sam hat 4 Ideen geliked 👀“ (ab 3 wartenden Likes, nicht nachts).

### Extras in Kürze (M21)

- **Überraschungs-Date:** Beim Planen „🎁 Als Überraschung planen“ plus optionaler Hinweis
  („Bequeme Schuhe“). Bis zum Tag selbst (00:00) sieht die andere Person nur Zeit und Hinweis –
  auf der Startseite, in Pushes, auf der Budget-Seite und im **Google-Kalender** (gemeinsamer
  Termin heißt „🎁 Überraschung von …“, ohne Ort). Verschieben darf sie nur die Zeit. Am Tag
  selbst bekommt der Termin seinen echten Titel und sie einen Push „🎁 Heute ist es soweit!“.
  Maskierung an einer Stelle: `dateForViewer()` / `maskSurprise()` (`src/core/date-extras.ts`).
- **Vorbereitung:** Checkliste am nächsten Date (für beide, bei einer Überraschung nur für den
  Planenden), mit Vorschlägen nach Stichwort („Tisch reservieren“, „Tickets kaufen“ …). Was am
  Vortag um 18 Uhr offen ist, kommt als Push.
- **Route:** „🗺️ Route (ÖPNV)“ öffnet Google Maps mit Bus & Bahn ab deinem Startpunkt
  (Einstellungen → Unterwegs & Teilen). Eine Fahrzeit in der App selbst bräuchte einen
  kostenpflichtigen Routen-Dienst – deshalb der Link.
- **Gesprächskarten:** 40 Fragen; am Tag des Dates direkt auf der Date-Karte, sonst unter
  „Unsere Dates“ → `/fragen`.
- **iPhone-Teilen:** iOS lässt Web-Apps nicht ins Teilen-Menü. Stattdessen ein Kurzbefehl, der
  den Link mit einem persönlichen Schlüssel an `POST /api/share` schickt; die Idee landet sofort
  auf der Wunschliste (Link → Idee mit KI) und der Kurzbefehl zeigt „💡 Auf eurer Wunschliste:
  …“. Gespeichert wird nur ein Hash des Schlüssels; neu erstellen oder löschen macht ihn ungültig.

### Date-Story in Kürze

- **`/story`** (Link auf „Unsere Dates“, ab 27. Dezember bis Ende Januar auch auf der
  Startseite, dazu ein Push „Eure Date-Story ist fertig 📖“): das Jahr zum Durchtippen –
  Anzahl Dates und Stunden, Lieblingsdate (mit Foto), Ø Herzen, Date-Monat und Lieblingstag,
  kurz vs. lang, Ausgaben und Spartopf, „Euer Ding“ beim Swipen (Lieblingsthemen, Matches, wer
  öfter nach rechts wischt), Fotos, Ausblick. Rechts tippen = weiter, links = zurück, Pfeiltasten
  gehen auch. Frühere Jahre oben auswählbar.
- Berechnet in `src/core/story.ts` (mit Tests). Herzen des Partners zählen erst, wenn beide
  bewertet haben – wie überall in der App.
- **„Euer Ding“** steht ab 10 Swipes auch unter dem Stapel auf „Entdecken“.

### Besondere Tage, „Vielleicht“ & alte Ideen in Kürze

- **Besondere Tage** (Einstellungen): Jahrestag, Geburtstag von euch beiden, eigene Tage
  („Unser erstes Date“). Jedes Jahr wieder; mit Startjahr zählt die App mit („2. Jahrestag“,
  „Sams Geburtstag (25)“). Logik in `src/core/special-days.ts` (mit Tests, auch 29. Februar).
- **Erinnerung** 2 Wochen und 2 Tage vorher um 10 Uhr (Push, abschaltbar), auf der
  Startseite eine Karte ab 3 Wochen vorher mit „Großes Date planen →“ (Planen startet dann mit
  „Lang“) und dem Stand des Spartopfs. **Geburtstage sieht und bekommt nur die andere Person**
  – für die Überraschung. Steht ein Tag in den nächsten 30 Tagen an, mischt der Stapel ein paar
  besondere Ideen dafür bei.
- **„Vielleicht“** (bis M31): Karten, die so zurückgestellt wurden, kommen zur passenden Jahreszeit
  wieder. Die Knöpfe sind seit M32 weg, die Logik im Server ist unverändert.
- **Alte Ideen:** Steht eine Idee seit 3 Monaten unverplant auf der Wunschliste, kommt sie
  (höchstens eine pro Tag) als Karte „🕰️ Steht seit März auf eurer Liste – noch Lust?“ in den
  Stapel. Ein 💚 reicht, damit sie bleibt; erst wenn beide ✕ sagen, fliegt sie von der Liste.
  Rückgängig geht auch hier.

### Budget & Spartopf in Kürze

- **Einstellen:** Einstellungen → Budget, z. B. 80 € im Monat (leer = kein Budget).
- **Was zählt** (`src/core/budget.ts`, mit Tests): Jedes Date bekommt beim Planen eine
  Schätzung (Kosten der Idee, bei Events der Preis × 2), im Rückblick tragt ihr den echten
  Betrag ein (vorausgefüllt). Abgesagte Dates zählen nicht.
- **Anzeige:** Balken auf Start- und Planen-Seite („Oktober: 45 von 80 € · noch 35 €“, grün →
  gelb → rot, Verplantes heller), Details unter `/budget`.
- **Spartopf:** Am Monatsende (Cron-Tick, `budget_months`) wandert der Rest in den Topf;
  ein überzogener Monat nimmt sich etwas daraus, nie unter 0. Beim Planen: „🎁 Aus dem
  Spartopf“ – das Date belastet dann nicht das Monatsbudget. Dazu ein Push mit dem
  Monatsrückblick an beide (abschaltbar).
- **Vorschläge passen sich an:** Ideen über dem Rest sind beim Planen markiert; Stapel,
  KI-Vorschläge und „Überrasch uns“ bevorzugen dann Günstiges.

### Tests & CI in Kürze

- **Unit-Tests** (Vitest) liegen neben der Logik in `src/core` und `src/lib`: `npm test`.
- **End-to-End** (`e2e/m*.mjs`): echte Produktions-Build, echter Browser
  (Playwright/Chromium), echte Postgres – Google, Claude, Wetter, Push und fremde Webseiten
  sind kleine Mock-Server auf `localhost:4010–4060`. `e2e/run.mjs` startet den Server mit
  Test-Umgebung, erzeugt Zertifikat und Schlüssel und lässt die Suites nacheinander laufen.
  Die Suites **leeren die Datenbank** – nur gegen eine Wegwerf-DB laufen lassen:
  ```bash
  # einmal in .env.local: E2E_DATABASE_URL=postgres://…/dateomat_test
  npm run e2e            # alle
  npm run e2e -- m5 m14  # einzelne
  ```
  Der Runner prüft, ob Postgres erreichbar ist, und baut neu, wenn sich seit dem letzten Build
  etwas in `src/`, `drizzle/` oder `public/` geändert hat (`--no-build` überspringt das).
  `npm run check` = Lint, Typecheck und Unit-Tests.
  Screenshots landen in `e2e/shots/`. Suites, die vom Wochentag abhängen (Frist, freie Zeiten
  diese Woche), stellen die Dev-Uhr auf Dienstag 10 Uhr der laufenden Woche (`e2e/clock.mjs`).
- **CI** (`.github/workflows/ci.yml`): bei jedem Push und Pull Request Lint, Typecheck,
  Unit-Tests; danach Build + alle E2E-Suites gegen einen Postgres-Service. Screenshots gibt's
  als Artefakt.

### Link → Idee in Kürze

- **Einfügen:** Einen Link (oder einen ganzen Teilen-Text mit Link) ins Titelfeld einer neuen
  Idee einsetzen – oder **🔗 Link einfügen** tippen (liest die Zwischenablage; iPhone fragt
  einmal nach). **Android:** in TikTok/Instagram/YouTube **Teilen → Date-O-Mat** (Manifest
  `share_target` → `/share`).
- **Lesen** (`src/server/link-ideas.ts`): TikTok und YouTube über ihre öffentliche oEmbed-
  Schnittstelle (Bildunterschrift, Kanal, Vorschaubild), alles andere über OpenGraph-Tags plus
  etwas Seitentext. Kurzlinks (vm.tiktok.com …) werden erst aufgelöst. Abgerufen wird mit
  denselben Schutzregeln wie die Event-Quellen (nur öffentliche Adressen, klein, schnell).
- **Verstehen:** Claude Haiku 5.5 bekommt Bildunterschrift/Beschreibung **und das
  Vorschaubild** und füllt Titel, Kurz/Lang, Notiz, Kosten, Ort (`LINK_SYSTEM_PROMPT` in
  `src/core/link-idea.ts`, mit Tests). Das Video selbst wird nicht angesehen – nur, was der
  Post über sich verrät. Der Inhalt gilt als Daten, nicht als Anweisung.
- **Nichts wird automatisch gespeichert:** Das Formular ist vorausgefüllt, ihr prüft und
  tippt **Speichern**. Der Link steht in der Idee, der Account als „via @…“ in der Notiz.
- **Ohne KI / Limit (30 pro Tag und Paar) / Fehler:** Titel = erster Satz der
  Bildunterschrift bzw. der Seitentitel. Liest sich der Link gar nicht (z. B. Instagram ohne
  Vorschau), bleibt er eingetragen und ihr schreibt den Titel selbst.

### Status & Warnungen in Kürze

- **Einstellungen → Läuft alles?** (ganz oben): Automatik (letzter Cron-Lauf, in
  `app_status`), beide Kalender, Push-Geräte je Person, Event-Quellen, KI-Verbrauch heute,
  Fotos. Eingeklappt mit „✅ Alles läuft“, sonst offen mit dem, was zu tun ist
  (`statusRows()` in `src/core/system-status.ts`, mit Tests).
- **Startseite:** Lief der Cron länger als 60 Minuten nicht, erscheint ein gelber Hinweis
  (erst nachdem er schon einmal lief – „noch nie“ zeigt nur die Status-Liste).
- **Kalender getrennt:** Lehnt Google den gespeicherten Zugang ab, wird die Verbindung beim
  Wechsel ok → „neu verbinden“ einmalig gemeldet: Push an die betroffene Person (führt zu
  Einstellungen → Kalender) und an den Partner („Sag … Bescheid“). Abschaltbar unter
  Erinnerungen → „Wichtiges“.

### KI-Vorschläge in Kürze

- **„✨ 3 Ideen von der KI“** beim Planen unter „Was anderes …“ (kennt den gewählten Termin und
  die Größe; „Nehmen“ wählt die Idee direkt aus).
- Budget und drinnen/draußen kommen aus dem gemeinsamen Filter; **Claude Haiku 5.5** liefert per
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

- **Köln-Ideen:** 40 handverlesene Ideen in `src/core/curated-ideas.ts` (feste IDs, grobe Kosten
  für zwei, drinnen/draußen). Seit M22 kommen sie als 📍-Karten in den Swipe-Stapel und stehen
  beim Planen unter „Was anderes …“. „Nehmen“ legt eine Idee mit `source = 'curated'` und
  `external_ref = <id>` an. Neue Ideen: einfach einen Eintrag in der Datei ergänzen.
- **„🎲 Zufall“** (beim Planen): zieht zufällig aus Wunschliste (doppelt gewichtet) und noch
  nicht gemerkten Köln-Ideen, ohne die letzten Ziehungen zu wiederholen (`pickSurprise()` in
  `src/core/surprise.ts`, mit Tests). „Nehmen“ wählt die Idee; eine Köln-Idee kommt dafür
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
- **Unterseiten** (M23, `src/core/source-pages.ts`, mit Tests): Beim ersten Lesen bekommt Claude
  einmal die Links der Startseite und sucht bis zu 6 Seiten mit vielen Events/Tipps aus
  (Kategorien, „Wochenende“, „Alle Events“) – nur Links von derselben Website, sonst wird
  verworfen. Sie stehen in `event_source_pages` und in den Einstellungen aufklappbar unter der
  Quelle, mit Einträgen pro Unterseite; ihr könnt sie entfernen oder eigene derselben Website
  hinzufügen (zusammen höchstens 10). Bestehende Quellen bekommen ihre Unterseiten beim
  nächsten Lesen (`event_sources.pages_picked_at`).
- **Lesen** (`src/server/events/`): Der Server holt die Seite selbst (`fetch-page.ts`), ihre
  Seite 2 (`followUpLinks()`: `rel="next"`, `?page=2` …) und alle Unterseiten. Stehen über alle
  Seiten mindestens 25 Events als schema.org-JSON-LD drin, werden nur die genommen – exakt und ohne KI.
  Sonst wird die Seite zu Text mit `[Link](url)` gekürzt (`htmlToText`) und **Claude Haiku 5.5**
  füllt per Structured Output eine feste Liste (Titel, Zeit, Ort, Preis, Link, Kurztext) – alle
  Seiten einer Quelle in einer Anfrage, bis zu 100 Einträge, jeder Tipp eines Listen-Artikels
  einzeln.
- **Prüfen** (`cleanItems()` in `src/core/events.ts`, mit Tests): Vergangenes und mehr als
  60 Tage Entferntes fliegt raus, Links zu fremden Domains werden verworfen, Doppelte entfernt.
- **Wann:** Der Cron-Tick liest ab 5 Uhr pro Lauf höchstens eine Quelle, die älter als 44 Std.
  ist (also jeden zweiten Morgen). Hat sich der Text seit dem letzten Mal nicht geändert
  (sha256 in `event_sources.content_hash`), bleiben die Einträge und Claude wird nicht gefragt;
  „Jetzt lesen“ fragt immer und geht jederzeit. Gelesen wird nach der Antwort an cron-job.org
  (`after()`).
- **„Was läuft“** (`/events`, Tab neben der Wunschliste): Events der nächsten drei Wochen nach
  Tagen, mit „✓ Ihr habt beide Zeit“ (eine FreeBusy-Abfrage pro Person, inkl. Puffer).
  „Als Date planen“ legt das Date direkt zur Event-Zeit an (mit Google-Einladung),
  „Merken“ setzt es auf die Wunschliste (`ideas.source = 'web'`).
- **Feed als zweiter Weg** (`src/core/feeds.ts`, mit Tests): Blockt eine Seite automatische
  Abrufe (z. B. HTTP 403), ist sie fast leer (JavaScript) oder ist sie eine Tipps-/Magazinseite,
  liest der Server ihren RSS-/Atom-Feed – aus dem Seitenkopf verlinkt oder WordPress-typisch
  unter `/feed/` (die 20 neuesten Artikel). Feeds enthalten oft die ganzen Artikel, also mehr
  Tipps als die Startseite.
  Findet eine als „Kalender“ eingetragene Seite nichts, liest die App sie noch einmal als
  Tipps-Seite und stellt sie um, wenn das etwas bringt.
- **Ohne `ANTHROPIC_API_KEY`** werden nur JSON-LD-Seiten gelesen; die Einstellungen sagen das.

### Slot-Finder in Kürze

1. FreeBusy für beide Personen und alle ausgewählten Kalender (nur Belegt-Zeiten, nichts wird gespeichert).
2. Puffer um jeden Termin legen, alles vereinigen.
3. Pro Tag im Zeitfenster (z. B. Start 10–21 Uhr, Ende spätestens 23 Uhr) die Lücken bestimmen,
   Startzeiten im 30-Minuten-Raster prüfen.
4. Jeden Kandidaten bewerten (`scoreSlot`): klein → Abende und Wochenend-Nachmittage,
   groß → Wochenende und viel Zeit am Stück; früher ist leicht besser, etwas Luft drumherum auch.
5. Bester Slot pro Tag, davon die fünf besten. Platz 1 ist der „Top-Tipp“.
6. **Draußen-Ideen** (M35) werden anders gewertet (`src/core/outdoor.ts`): starker Abzug, wenn der
   Slot nach Sonnenuntergang liegt (`src/core/sun.ts`, selbst berechnet für Köln), Bonus für
   Wochenend-Nachmittage, Abzug bei Regen ab 60 % oder unter 8 °C (stündliche Vorhersage von
   Open-Meteo, eine Abfrage pro Suche; ohne Vorhersage neutral). Ausnahme: Ideen mit Stichwörtern wie
   Sterne, Sonnenuntergang, Lichter (`darknessWanted()`) verlieren nichts für die Dunkelheit.
   Die Zeile an der Zeit sagt es: „☀️ 14°, trocken · hell bis 18:20“. Welche Idee Draußen ist,
   steht in `ideas.setting` (Formular: „Wo?“; Swipe-Karten, Köln-Ideen und KI-Ideen bringen es mit).

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
  internen Namen). Die DNS-Prüfung passiert beim Verbindungsaufbau selbst und die Verbindung
  nutzt genau die geprüfte Adresse (kein DNS-Rebinding); jede Weiterleitung wird neu geprüft
  (`src/server/events/fetch-page.ts`, `src/lib/url-safety.ts`). Seiten: höchstens 3 MB, 15 s;
  ausgewertet wird nur das erste MB, mit linearen Durchläufen statt anfälliger Regex.
  Seiteninhalt gilt als fremd: Claude füllt nur ein festes JSON-Schema, alles wird danach
  nochmal geprüft, Links müssen zur Quelle gehören. An Claude geht nur der Seitentext.
- **Kostenbremse:** Jeder Claude-Aufruf wird vorher gebucht (mit Sperre pro Paar, zählt auch
  bei Fehlern): höchstens 20 KI-Vorschlags-Runden und 40 Seiten-Auswertungen pro Tag;
  „Jetzt lesen“ höchstens alle 10 Minuten pro Quelle.
- **Verdeckte Bewertungen** fließen weder in „Ø Herzen“/„Lieblingsdate“ noch in die KI-Anfrage
  ein, solange ihr selbst noch nicht bewertet habt (`visibleRatings()`).
- **Test-Schalter** (`ALLOW_PRIVATE_EVENT_URLS`, `*_BASE_URL`, lokaler Foto-Ordner) werden auf
  der Vercel-Produktion ignoriert, auch wenn sie versehentlich gesetzt sind.

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
