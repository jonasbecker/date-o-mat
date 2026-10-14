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

### Bedienung in Kürze (M13)

- **Einführung** (`/welcome`): vier Karten nach dem Koppeln (Rhythmus/Modus und Namen
  eingesetzt), danach nie wieder automatisch – `users.onboarded_at`. In den Einstellungen
  unter „Hilfe“ jederzeit erneut.
- **Startseite:** oben genau eine Karte „Dein nächster Schritt“ (`nextStep()` in
  `src/core/next-step.ts`, mit Tests): Kalender verbinden → „Passt!“ geben → planen →
  bewerten → sonst „Stand der Dinge“. Darunter das nächste Date, eine **Start-Checkliste**
  (Kalender, Home-Bildschirm, Push; verschwindet, wenn alles erledigt ist) und zwei kleine
  Kacheln zu Ideen und Events.
- **ⓘ-Hilfen:** `<Info term="…">` mit Texten aus `src/lib/glossary.ts`, über die Popover-API
  des Browsers (kein eigenes JavaScript).
- **Planen:** „⚡ Schnell planen“ (Top-Termin + älteste kurze Idee, ein Tipp) und unter
  „Was machen wir?“ alle Quellen als Reiter: Wunschliste, Köln, Events (nur wo ihr beide Zeit
  habt), KI, Zufall, Eigene. Was man nimmt, landet auf der Wunschliste und ist sofort gewählt.
- **Wörter:** Kurz/Lang statt Klein/Groß, „Diese Woche“ statt „Runde 3“, „Plan bis …“ statt
  „Deadline“. Einstellungen in „Für euch beide“ und „Nur für dich“, Zeitfenster eingeklappt.

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
- **Swipen:** rechts/💚 = gerne, links/✕ = nö, hoch/⭐ = Super-Like (einmal am Tag, der Partner
  sieht ihn mit Namen), ↩️ nimmt den letzten Swipe zurück – beliebig oft hintereinander.
  Tastatur: ← → ↑ und Rücktaste. Filter: Günstig, Drinnen, Draußen, Kurz, Lang, Mit Event;
  „Mehr … holen“ macht gezielt passende Karten.
- **Match:** Jede:r swipet für sich. Erst wenn beide 💚 geben: „Match! 💞“ mit Konfetti, Push an
  beide, Idee auf der Wunschliste (`source = 'deck'`) und „📅 Jetzt planen“. Ein ✕ von einem
  nimmt die Karte für beide aus dem Stapel. Was der Partner gemocht hat, kommt bei dir früher
  dran – ohne es zu verraten. Rückgängig nach einem Match nimmt die Idee wieder von der Liste
  (außer sie ist schon als Date geplant).
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
- **„Vielleicht“** (🤔 oder nach unten wischen): Die Karte verschwindet nur für dich und kommt
  zur passenden Jahreszeit wieder (Claude gibt jeder Karte eine „beste Jahreszeit“; Freibad →
  1. Juni), sonst nach drei Wochen. „Jetzt nochmal ansehen“ holt sie sofort zurück.
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
  DATABASE_URL=postgres://…/dateomat_test npm run build
  DATABASE_URL=postgres://…/dateomat_test npm run e2e            # alle
  DATABASE_URL=postgres://…/dateomat_test npm run e2e -- m5 m14  # einzelne
  ```
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
