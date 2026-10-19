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
- Design tokens are in `src/app/globals.css` (`sticker`, `press` utilities); bright fills use `text-tinte`.
  In dark mode the light fills (`bg-zitrone-soft`, `bg-himbeere` …) reset the color tokens to light values,
  so `text-ink`/`text-muted` on them stay readable – new light fills go into that list.
- **Design (M29, direction A):** the sticker look (`sticker`, thick outline + hard shadow) is only for
  what you tap next – primary buttons and the next date. Lists, infos and secondary buttons are `flat`
  (outline only, `tap` feedback). Color roles: pink = action, the person colors = whose turn,
  minze = it stands/confirmed, yellow = hints and warnings only, everything else neutral. Controls use
  the icons in `components/icons.tsx`; emoji stay for content (ideas, confetti, match, choices).
  Small labels are normal case, not uppercase. Empty and loading states show the `Mascot`.
- Slot ranking stays pure: `scoreSlot`/`findSlots` get daylight and the hourly forecast as
  parameters (`core/outdoor.ts`, `core/sun.ts`); the one forecast request per search lives in
  `server/weather.ts`. Outdoor ideas (`ideas.setting`) use the outdoor ranking, see `core/slot-modes.ts`.
- Lists of ideas/events filter with the one shared filter (`useIdeaFilter()`, `matchesIdeaFilter()`),
  never with their own chips. New extras go behind `extraOn(settings, …)` and show up only when they fit.

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
- **Planning in e2e:** `/plan` is the start (step card + swipe deck); "Date planen" opens the
  two-step flow at `/plan?pick=1`. Use `e2e/flow.mjs` (`openFlow`, `pickIdea`, `openTimes`,
  `customIdea`, `backAtStart`) instead of expecting the wishlist or the times (`ol li button`) right away.
  The next date sits in the step card (`[data-next-step] [data-date-card]`); its checklist,
  "Zeit ändern" and "Absagen" are on `/dates/<id>` ("Details ›").
- **Hidden pages in e2e:** Next keeps the last visited pages mounted but hidden, so `getByText` can match
  twice – prefer `getByRole` (ignores hidden elements) or `{ exact: true }` / `.filter({ visible: true })`.
- **Timing in e2e:** CI is slower than the container. Wait for the UI that proves a state (e.g. the
  filter button showing the stored filter after hydration) instead of checking right after a load.
- **After every push:** check the CI run (GitHub MCP `actions_list` → `list_workflow_runs`) until
  it is green; a red run is fixed before the next task, never left for later.
- Never run prettier (the repo has no config; it rewrites whole files).
