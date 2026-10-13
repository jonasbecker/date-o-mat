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
| M3 | Kalender & Slot-Finder | ⏳ |
| M4 | Rhythmus, Modi, Zyklen, Startseite | ⏳ |
| M5 | Google-Termine mit Einladung | ⏳ |
| M6 | Push-Erinnerungen | ⏳ |
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
cron-job.org ── alle 5 Min ──▶ /api/cron/tick   (ab M4)
```

```
src/
  app/                Seiten (UI) und Route Handler (API)
    (app)/            eingeloggter Bereich mit Navigation
    login/, pair/     Login und Kopplung
    api/auth/google/  OAuth-Start und -Callback
  components/         UI-Bausteine (Button, Card, Avatar, Logo …)
  lib/                reine Hilfsfunktionen ohne Server-Zugriff (getestet)
  server/             alles mit DB, Secrets oder Google
    auth/             Sessions, Data Access Layer (requireUser/requireCouple), OAuth
    db/               Drizzle-Client und Schema
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
- **Kernlogik ohne I/O** (Slots, Zyklen, Erinnerungen ab M3/M4) liegt als reine Funktionen
  vor und ist mit Tests abgedeckt.

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

## Sicherheit & Datenschutz

- Login nur für Adressen in `ALLOWED_EMAILS`. Danach gilt die Kopplung per Einladungscode;
  sind zwei Personen drin, wird der Code gelöscht.
- Sessions: zufälliges Token im httpOnly-Cookie, in der DB nur dessen SHA-256-Hash.
- Google-Tokens werden AES-256-GCM-verschlüsselt gespeichert (`TOKEN_ENCRYPTION_KEY`).
- Aus den Kalendern liest die App nur Belegt-Zeiten (FreeBusy) und speichert keine Termindetails.
- Alle Secrets liegen nur in Umgebungsvariablen (`.env.example` als Vorlage).
