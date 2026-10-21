@AGENTS.md

# Zweisamen – project notes

Date planner PWA for exactly one couple. Plan and decisions: `docs/PLAN.md`. Setup: `docs/SETUP.md`.

## Conventions

- UI copy is **German**; code, identifiers, comments and commit messages are **English**.
- Time zone is always `Europe/Berlin` (`APP_TIMEZONE` in `src/lib/domain.ts`); use Luxon for date math.
- Pure logic (no DB, no `next/*`) lives in `src/lib` (later `src/core`) and gets Vitest tests next to it.
- Server-only code lives in `src/server` and imports `server-only`.
- Every page/action gets the user via `requireUser()`/`requireCouple()` (`src/server/auth/dal.ts`).
- Cache Components is on: anything reading cookies or the DB must render inside `<Suspense>`. Signed-in pages have
  ONE boundary, in the `(app)` layout (fallback `BeetSkeleton`) – no `<Suspense>` around a whole page: it would flash
  its skeleton on every tab switch. A slow part inside a page may have its own.
- Status-like columns are `text` with TS enums from `src/lib/domain.ts` – never Postgres enums.
- Schema change → `npm run db:generate` → commit the SQL in `drizzle/`.
- Mutations are server actions that call `refresh()`; pages that show shared data render `<AutoRefresh />`.
- Google Calendar calls go through `calendarRequest()` (`src/server/google/calendar-api.ts`), which awaits `connection()` first so prefetch/prerender never hits Google. Call `connection()` before any try/catch around live Google data.
- "Now" for a couple is `coupleNow(settings)` (`src/server/clock.ts`), never `new Date()` in round/slot logic – the dev clock shifts it.
- Pages that use time or write round state call `await connection()` right after `requireCouple()`.
  While the dev clock is moved (`ENABLE_DEV_TOOLS=1`), the Beet says so (`data-dev-clock`, reset in `?t=konto`).
- **Design ("Garten", dark only):** spec and mockups in `docs/design/garten/` (DESIGN-GARTEN.md + `screens/*.html`,
  `components/Bloom.html`) – it replaces the older DESIGN.md / main-b for these pages. The whole app is dark:
  `<html data-theme="dark">` is fixed in `layout.tsx`, one token set in `globals.css` (`bg`, `surface`, `ink`, `muted`,
  `track` + Garten: `butter`, `green`, `like`, `divider`, `text-soft`, `muted-2`, `cta`, `soil`, `seed`, `tile-*`).
  Fonts Bricolage Grotesque, DM Mono (`meta`), Caveat (`font-hand`, only the flower's voice). Person colors
  (`PERSON_HEX`: himmel = #4D63E8, mandarine = rosé) are accents only. Primary pill = `bg-cta text-bg`. Light fills
  (`bg-tile-*`, `bg-rose`, `bg-zitrone-soft` …) reset the tokens to light values, so `text-ink` on them stays readable
  – `bg-cta`/`bg-butter` are NOT in that list (their text is dark by design). Garden words: Ideen = Samen, Like =
  einpflanzen, Nein = Kompost, Match = keimt / Matchlinge, Frist = Gießzeit, Rhythmus = Gießrhythmus, Planen = gießen.
- **Tabs feel like an app:** `staleTimes.dynamic` (next.config) keeps visited pages for 5 minutes – a tab comes back
  at once. A `router.refresh()` drops all those copies, so `AutoRefresh` (a server component: it renders the couple's
  fingerprint, `server/stamp.ts` – row counts + `xmin` per table, bookkeeping columns left out – plus a 5-minute
  bucket) only refreshes when `stampAction()` returns a different one (on show, foreground, every 15 s). A new table goes
  into `core/stamp-tables.ts` (or `NOT_STAMPED` with a reason) – `stamp-tables.test.ts` fails otherwise. Actions that `redirect()` call `refresh()` first. No page fade-in (no `template.tsx`).
  Because the loading boundary sits in the layout, a first visit keeps the old page until the new one is there (the
  tab lights up at once via `useLinkStatus`, `nav-pending.tsx` shows a thin bar after 150 ms). e2e: m26 (first visits
  too).
- **Server errors:** `src/instrumentation.ts` (`onRequestError`) → `server/server-errors.ts`: counted in `app_status`
  (`errors`, left out of the stamp so a failing page cannot refresh itself in a loop), shown as "Fehler" under
  Einstellungen → Status, push type `errors` (off by default, `NOTIFICATIONS_OFF_BY_DEFAULT`) at most once a day.
- **Gestures and offline:** `components/gestures.tsx` – from the left edge = back where the page has a back arrow
  (mark it `data-back`; installed app only, `localStorage["dom-gestures"]="1"` elsewhere), pull down at the top =
  `router.refresh()` (not on `[data-sheet-card]`, the swipe card, dialogs, fields, `[data-no-pull]`). `public/sw.js`
  keeps the pages you opened (network first; offline: their last state, `/` → the Beet, else `offline.html`) and the
  `/_next/static` files; the login page forgets the pages (`forget-pages.tsx`). `offline-note.tsx` says so. e2e: m27
  (Playwright's `setOffline` does not reach the service worker – cut the network with `context.route` and
  `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`, see m7/m27).
- **Smooth on phones:** what follows a finger moves with `transform` only and renders at most once per frame – the swipe
  card is moved straight in the DOM (React hears only the stamp), the date sheet's frame moves around content of one
  fixed size (never re-wrapped), bubble and dots are translated; `Bloom` and the swipe `Card` are memoized.
- **Navigation (M40):** `BottomNav` in the `(app)` layout: Archiv (`/dates`) · Swipen (`/ideas/entdecken`) · **Beet** (`/plan`,
  the big green circle, always on top – the bar is `z-30`) · Ideen · Einstellungen. `AppHeader` is the small name plus the page's
  own thing on the right (avatars, "36 Ideen", matches pill). The four dots are one path: the Beet is dot 1, the
  planning flow's filter / "was?" / "wann?" are dots 2–4 (`flowTop` in `plan-form.tsx`); once a date is proposed
  the Beet shows them as one lit bar (`StepDots all`). `/ideas` shows tiles; a tile opens `/ideas?ansicht=<kind>` (URL-driven, so the
  Ideen tab brings you back); the one Filter button (incl. category) is the only filter.
- **Setup (Garten):** `/settings` is the garden shed (`setup-main.tsx`: "Wer gießt?", Gießrhythmus, Gießzeit, push
  switch; calendars + "Freie Abende ab"; `flower-card.tsx`: the flower's name and pot – `couple_settings.flower_name`,
  `flower_pot`, pots unlock at 10/25 lived dates, `core/bloom.ts`). `garden-banner.tsx` shows only when something is
  missing (calendar, status – push is only the switch). The page is "einstellungen." (no "gartenschuppen"). "Mehr" (`?t=mehr`) lists the other topics.
- **Swipen (C2 card, `docs/design/garten/swipe-karte/`):** `swipe-deck.tsx` – the light card with a picture strip
  (`components/illustrations.tsx`, all of them on `/dev/illustrationen`), the day big (combo: the event; else the next
  free evening / half day from one FreeBusy query per page, `core/card-when.ts`; none → "irgendwann.", never a made-up date), WO · DAUER · KOSTEN (never cut: in plain CSS the picture gives way first – `flex-shrink`, text `flex 1 0 auto`;
  then `fitCard()` measures where the info box ends – geometry, not scrollHeight, Safari differs – on every size change
  and sets the steps `data-d1…5` styled in globals.css `.swipe-card`; m24 checks five heights, a hidden tab, no measuring); swiping only,
  with the EINPFLANZEN / KOMPOST stamp; the flower (a new quip every 10 s; tap = "sam hat n geswipt." + "deine likes ›" for 5 s – no line under the title) reacts happy / sad and also says what a swipe
  changed or what went wrong – no small text under the card. ⓘ next to the Matchlinge (how it works, "n geswipt · n
  übrig", Mehr Ideen, Euer Ding) and ↺ next to the filter live in `deck-chrome.tsx`. For keyboard / screen readers the
  two choices are sr-only buttons on the card ("Einpflanzen", "Auf den Kompost" – e2e presses them with
  `dispatchEvent("click")`). Look and quips are stored on `deck_cards` and `ideas`
  (`color`, `illustrations`, `quips`): Claude writes them in the batch call, `server/card-art.ts` in one small call
  after an idea is created (kind `art`); empty → `core/card-art.ts` (category + cost/place/size). e2e fakes answer
  that call via `e2e/claude-art.mjs` (outside their call counts). "keimt!" for a match.
- **Ideen / Archiv (Garten):** the seed shelf (`idea-tiles.tsx`, Matchlinge in pots; "Meine Likes" = `?ansicht=geswipt`
  shows only my likes + matches), the stem (`/dates`, titled "archiv.",
  `?ansicht=raster` is the old grid).
- **The Beet (start, Main B – `docs/design/main-b/`):** `src/app/(app)/beet.tsx` – headline per step ("du bist dran.",
  "sam ist dran." – always the same size –, "wartet auf sam." after watering, "date steht." …) at up to 70 px, the time left big on the right (`TimeLeft`, `--accent-time`), the round as its weekdays
  (`WeekBar`: today lit, the bar filled up to today – no deadline marker, it looked like a slider handle), the flower (`components/bloom.tsx`, geometry and mood in `core/bloom.ts`: `bloomGeometry`
  is renderVals() of Bloom.html 1:1, `bloomStimmung` = §3, `bloomLeaves` = the last 5 rounds from `server/plant.ts`)
  with its thought bubble in Caveat (`font-hand`; `components/flower-voice.tsx` – it is also the one reminder hint:
  "mein wecker ist aus – tipp mich an." turns push on, no row of its own), and one action ("Date planen" + the round hand-over button,
  "Anstupsen", "Zusagen"). The pot has no face. All moods side by side: `/dev/blume` (seven: the round's five +
  `genervt` / `autsch` for the date sheet).
  **"date steht."** (`docs/design/garten/date-steht/`, `date-sheet.tsx`, geometry `core/date-sheet.ts`): no "Details ›" – the
  card is a sheet (bottom edge fixed, only its top moves) with three stops (`data-date-sheet`): `zu` (only title and
  when · where – the closed card is as high as that text; the flower fills the room between the text and the card), `mitte` (the reference's open card, the rest cut off with a
  fade; if the browser scrolls it – focus, a link further down – it goes to voll) and `voll` (covers the screen under
  the header, all without scrolling, the handle becomes the header's step bar, the flower flies off the top and comes
  back down with the card). Everything between follows the card's top (`position()` 0…2). Letting go faster than
  0.8 px/ms is a "schubs" (one stop further; zu → mitte kicks the flower: `autsch`, overshoot, motion lines), else
  "sanft" (`genervt`); past 35 % of the way it goes to the next stop. Held still ≥ 300 ms before letting go, the card
  stays right there (`data-parked`, `parks()`; the bubble finishes growing) until the next tap takes it to the nearest
  stop. The glide to a stop takes as long as its way needs and starts at the finger's speed (`glide()`); the flower
  sways as it stops and gives a little on landing from above. Tap: zu ↔ mitte, voll → mitte ("Weniger
  Details"). Closed, the flower's bubble sits by its head; pulled up, the header's step bar grows into the bubble at
  mitte (`morphAt` / `morphTransform`: the bar's place and size → the bubble's, words fade in at the end) and shrinks
  back into it on the way to voll. Dots come out of the mouth, nothing covers text, card, name or avatars; back gesture closes it. e2e: m25 (both sizes, slow/fast, parked, voll, back, reduced motion). The old `Plant`
  (components/plant.tsx) is only the small mark (logo, mascot, empty states).
- **Rounds and dates:** a date lives in the round it happens in (`cycleForDate()` creates later rounds when a date is
  planned ahead; the current round is the one containing now, never just the newest row). A planned date nobody
  confirmed does not turn "done" by itself: the Beet asks "habt ihr's gemacht?" (step `did_it`, `markHappened` /
  `markNotHappened`). "Zusagen" carries the time that was shown (`confirmDateAction(id, startIso)`).
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
  check new screens with `fitsScreen(page)` from `e2e/flow.mjs`. Small phones (360×640) may scroll, but nothing
  may overlap or be cut off: m24 runs `layoutAudit()` (`e2e/layout-audit.mjs`) on every page at both sizes. Settings links are `/settings?t=<topic>`.
- **Planning in e2e:** `/plan` is the start (the Beet); "Date planen" opens the one planning
  flow at `/plan?pick=1`: "was?" (tap an idea, "Weiter") then "wann?" (the send button is `SEND` in
  `flow.mjs`; `backToIdeas()` is the arrow at the top). Use `e2e/flow.mjs` (`openFlow`, `pickIdea`, `openTimes`,
  `customIdea`, `backAtStart`) instead of expecting the wishlist or the times (`ol li button`) right away.
  The next date sits on the Beet (`[data-next-step] [data-date-card]`); its checklist,
  "Zeit ändern" and "Absagen" are in the date sheet ("Details öffnen") and on `/dates/<id>`.
- **Hidden pages in e2e:** Next keeps the last visited pages mounted but hidden, so `getByText` can match
  twice – prefer `getByRole` (ignores hidden elements) or `{ exact: true }` / `.filter({ visible: true })`.
- **Timing in e2e:** CI is slower than the container. Wait for the UI that proves a state (e.g. the
  filter button showing the stored filter after hydration) instead of checking right after a load.
- **After every push:** check the CI run (GitHub MCP `actions_list` → `list_workflow_runs`) until
  it is green; a red run is fixed before the next task, never left for later.
- Never run prettier (the repo has no config; it rewrites whole files).
