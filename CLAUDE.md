@AGENTS.md

# Date-O-Mat – project notes

Date planner PWA for exactly one couple. Plan and decisions: `docs/PLAN.md`. Setup: `docs/SETUP.md`.

## Conventions

- UI copy is **German**; code, identifiers, comments and commit messages are **English**.
- Time zone is always `Europe/Berlin` (`APP_TIMEZONE` in `src/lib/domain.ts`); use Luxon for date math.
- Pure logic (no DB, no `next/*`) lives in `src/lib` (later `src/core`) and gets Vitest tests next to it.
- Server-only code lives in `src/server` and imports `server-only`.
- Every page/action gets the user via `requireUser()`/`requireCouple()` (`src/server/auth/dal.ts`).
- Cache Components is on: anything reading cookies or the DB must render inside `<Suspense>` in the page.
- Status-like columns are `text` with TS enums from `src/lib/domain.ts` – never Postgres enums.
- Schema change → `npm run db:generate` → commit the SQL in `drizzle/`.
- Mutations are server actions that call `refresh()`; pages that show shared data render `<AutoRefresh />`.
- Google Calendar calls go through `calendarRequest()` (`src/server/google/calendar-api.ts`), which awaits `connection()` first so prefetch/prerender never hits Google. Call `connection()` before any try/catch around live Google data.
- "Now" for a couple is `coupleNow(settings)` (`src/server/clock.ts`), never `new Date()` in round/slot logic – the dev clock shifts it.
- Pages that use time or write round state call `await connection()` right after `requireCouple()`.
- **Design (M40, "Pastell & rund"):** spec and mockups in `docs/design/` (DESIGN.md + `screens/*.html`).
  Tokens in `src/app/globals.css` (salbei `bg`, white `surface`, `soft`, `ink`, `muted`, leaf/pot/bud,
  `rose`, the `tile-*` pastels); fonts Bricolage Grotesque + DM Mono (`font-mono`, `meta`). One background
  for every screen; person colors (`PERSON_HEX`: himmel = blue, mandarine = rosé) are accents only
  (avatar ring, watering can, "Gießen & senden"). Page titles are lowercase with a period (`headline`
  utility: "ideen.", "swipen."). White cards, no borders, no shadows (except the swipe card); pills
  (`Button`: primary = ink, `send` = blue, secondary = outline). `sticker`/`flat` are kept as no-op names.
  In dark mode the pastel fills (`bg-zitrone-soft`, `bg-rose`, `bg-tile-*` …) reset the color tokens to
  light values, so `text-ink`/`text-muted` on them stay readable – new light fills go into that list.
  Empty and loading states show the `Mascot` (a small plant).
- **Navigation (M40):** `BottomNav` in the `(app)` layout: Beet (`/plan`) · Ideen · **Swipen** (big circle,
  `/ideas/entdecken`) · Archiv (`/dates`) · Einstellungen. `AppHeader` is the small name plus the page's
  own thing on the right (avatars, "36 Ideen", matches pill). The four round dots sit right under the name
  on the Beet and never move. `/ideas` shows tiles; a tile opens `/ideas?ansicht=<kind>` (URL-driven, so the
  Ideen tab brings you back); the one Filter button (incl. category) is the only filter.
- **Setup (M40):** `/settings` is the MSetup page (`setup-main.tsx`: who plans, rhythm, deadline, push switch,
  calendars, "Freie Abende ab" – every control saves by itself); "Mehr" (`?t=mehr`) lists the other topics.
  Theme: Hell/Dunkel/Automatisch (`theme-switch.tsx`, `data-theme` on `<html>` set before paint in `layout.tsx`;
  the `dark:` variant follows it).
- **The Beet (start, Main B – `docs/design/main-b/`):** `src/app/(app)/beet.tsx` – headline per step ("du bist dran.",
  "kanne bei Sam." …) at 70 px, the time left big on the right (`TimeLeft`, `--accent-time`), the round as a bar with the
  deadline marker (`WeekBar`), the flower (`components/bloom.tsx`, geometry and mood in `core/bloom.ts`: `bloomGeometry`
  is renderVals() of Bloom.html 1:1, `bloomStimmung` = §3, `bloomLeaves` = the last 5 rounds from `server/plant.ts`)
  with its thought bubble in Caveat (`font-hand`), and one action ("Date planen" + the round hand-over button,
  "Anstupsen", "Zusagen"). The pot has no face. All five moods side by side: `/dev/blume`. The old `Plant`
  (components/plant.tsx) is only the small mark (logo, mascot, empty states).
- Slot ranking stays pure: `scoreSlot`/`findSlots` get daylight and the hourly forecast as
  parameters (`core/outdoor.ts`, `core/sun.ts`); the one forecast request per search lives in
  `server/weather.ts`. Outdoor ideas (`ideas.setting`) use the outdoor ranking, see `core/slot-modes.ts`.
- Lists of ideas/events filter with the one shared filter (`useIdeaFilter()`, `matchesIdeaFilter()`),
  never with their own chips (the chips row above the wishlist only drives that filter's `category`
  plus the local views Matches/Geswipt and the tiles of `/ideas`, see `idea-board.tsx` `inView`). Ideas without `ideas.category` use `categoryOf()`.
  New extras go behind `extraOn(settings, …)` and show up only when they fit.

## Checks before pushing

`npm run check && npm run build` – and the affected e2e suites (`npm run e2e -- m12 m17`).

## Working routine

- **e2e:** `npm run e2e [-- m5 m9]` needs no env vars: it reads `E2E_DATABASE_URL` (environment or
  `.env.local`), finds the container's Chromium, checks Postgres and rebuilds when `src/`,
  `drizzle/` or `public/` changed. While iterating run only the suites that touch the change; run
  the full suite once before the push.
- **UI changes:** grep `e2e/*.mjs` for the labels/headings you rename or move before running –
  every renamed button breaks a locator somewhere. Look at the screenshots in `e2e/shots/`
  (light and dark) instead of trusting green checks alone.
- **Weekday/date-sensitive tests:** the suites run on any day. Round logic → pin the dev clock with
  `tuesdayMorningOffset()` (`e2e/clock.mjs`); slot lists late in the week → `/plan?later=1`;
  decks/lists that a test empties → seed spare rows. A test that only fails on some days is a test bug.
- **No scrolling (M27):** every screen fits 390×844 – only lists scroll (wishlist, events, sheets,
  long settings topics). Long content becomes steps, pages or tabs (`Tabs`, `?t=` topics, paging);
  check new screens with `fitsScreen(page)` from `e2e/flow.mjs`. Settings links are `/settings?t=<topic>`.
- **Planning in e2e:** `/plan` is the start (the Beet); "Date planen" opens the one planning
  flow at `/plan?pick=1`: "was?" (tap an idea, "Weiter") then "wann?" (the send button is `SEND` in
  `flow.mjs`; `backToIdeas()` is the arrow at the top). Use `e2e/flow.mjs` (`openFlow`, `pickIdea`, `openTimes`,
  `customIdea`, `backAtStart`) instead of expecting the wishlist or the times (`ol li button`) right away.
  The next date sits on the Beet (`[data-next-step] [data-date-card]`); its checklist,
  "Zeit ändern" and "Absagen" are on `/dates/<id>` ("Details ›").
- **Hidden pages in e2e:** Next keeps the last visited pages mounted but hidden, so `getByText` can match
  twice – prefer `getByRole` (ignores hidden elements) or `{ exact: true }` / `.filter({ visible: true })`.
- **Timing in e2e:** CI is slower than the container. Wait for the UI that proves a state (e.g. the
  filter button showing the stored filter after hydration) instead of checking right after a load.
- **After every push:** check the CI run (GitHub MCP `actions_list` → `list_workflow_runs`) until
  it is green; a red run is fixed before the next task, never left for later.
- Never run prettier (the repo has no config; it rewrites whole files).
