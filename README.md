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
| M7 | Politur & PWA | ⏳ |

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
  components/         UI-Bausteine (Button, Card, Avatar, Logo …)
  core/               Kernlogik ohne I/O: Slot-Finder, Zeitbereiche, Kalender-Regeln (getestet)
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
    tick.ts           der periodische Job hinter /api/cron/tick
  proxy.ts            schickt Besucher ohne Session-Cookie zur Login-Seite
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
  Deadline in 24 Std., Partner:in plant/bestätigt/sagt ab, Date morgen (19 Uhr am Vortag),
  Date in 2 Stunden.
- **Wann:** `src/core/reminders.ts` berechnet rein aus Runde, Date und Uhrzeit, was fällig ist.
  Ruhezeit 22–8 Uhr (außer „Date in 2 Stunden“); was mehr als 2 Std. zu spät wäre, entfällt.
- **Genau einmal:** Vor dem Senden wird jede Erinnerung in `notification_log` eingetragen
  (eindeutiger Schlüssel). Nur wenn das klappt, geht sie raus – parallele Ticks senden nie doppelt.
- Partner-Nachrichten gehen sofort nach der Aktion raus (`after()`), unabhängig von der Ruhezeit,
  weil die andere Person ja gerade selbst aktiv ist.

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
| `push_subscriptions`, `notification_prefs`, `notification_log` | Push |

Für V2 vorbereitet, aber nicht in der UI: `date_plans.rating`/`review_note` (Rückblick),
`ideas.source`/`external_ref` (kuratierte bzw. KI-Ideen).

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
| **Kuratierte Ideen für Köln** | Neue Datei `src/server/idea-sources/curated.ts`, die `IdeaSourceProvider` implementiert (z. B. aus einer JSON-Datei oder Tabelle mit `ideas.source = 'curated'`), und in `PROVIDERS` in `src/server/idea-sources/index.ts` eintragen. Vorschlag-Modus und Planen nutzen sie dann automatisch. |
| **KI-Vorschläge** (Budget, Wetter, Dauer, Stimmung) | Ebenfalls ein `IdeaSourceProvider` (`source = 'ai'`), der aus Kontext (Slot-Größe, Wetter-API, Budget) Kandidaten erzeugt; erzeugte Ideen können mit `external_ref` in `ideas` gespeichert werden. |
| **Zufall („Überrasch uns“)** | Eine kleine Funktion neben `pickSuggestion` (`src/core/suggestion.ts`), die statt der ältesten eine zufällige Idee aus `ideaCandidates()` zieht, plus ein Button auf der Startseite. |
| **Rückblick nach dem Date** | `date_plans.rating` und `review_note` existieren schon; für Fotos kommt eine neue Tabelle `date_photos` dazu. Nur UI nötig. |

## Sicherheit & Datenschutz

- Login nur für Adressen in `ALLOWED_EMAILS`. Danach gilt die Kopplung per Einladungscode;
  sind zwei Personen drin, wird der Code gelöscht.
- Sessions: zufälliges Token im httpOnly-Cookie, in der DB nur dessen SHA-256-Hash.
- Google-Tokens werden AES-256-GCM-verschlüsselt gespeichert (`TOKEN_ENCRYPTION_KEY`).
- Aus den Kalendern liest die App nur Belegt-Zeiten (FreeBusy) und speichert keine Termindetails.
- Alle Secrets liegen nur in Umgebungsvariablen (`.env.example` als Vorlage).
- `/api/cron/tick` verlangt `Authorization: Bearer <CRON_SECRET>` (zeitkonstanter Vergleich).
