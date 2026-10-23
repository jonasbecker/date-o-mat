// Test dates for the Archiv (Einstellungen → Testdates): a handful of past dates with everything the Archiv can show –
// both reviews or one or none, "nochmal?", notes, a checklist, photos, costs – and one round that fell through. Pure:
// what to write for a given "now"; server/demo-dates.ts writes it, switching off deletes it again.
//
// All of it lies at least three weeks back: older than the "wie war's?" window (REVIEW_PROMPT_DAYS), so no reminder, no
// app icon number and no question on the Beet ever comes from a test date.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type AgainAnswer, type IdeaSize } from "@/lib/domain";
import { REVIEW_PROMPT_DAYS } from "./reviews";

/** 0 = the one switching them on, 1 = the partner. */
type Who = 0 | 1;

export type DemoDate = {
  weeksAgo: number;
  /** 1 = Monday … 7 = Sunday, and the start time. */
  weekday: number;
  hour: number;
  minute?: number;
  hours: number;
  title: string;
  size: IdeaSize;
  location: string | null;
  note: string | null;
  organizer: Who;
  costEur: number | null;
  reviews: Array<{ who: Who; rating: number; note: string | null; again: AgainAnswer | null }>;
  tasks: Array<{ title: string; done: boolean }>;
  /** How many photos (drawn ones, `demoPhotoSvg`). */
  photos: number;
};

export const DEMO_DATES: DemoDate[] = [
  {
    weeksAgo: 3,
    weekday: 5,
    hour: 19,
    minute: 30,
    hours: 3,
    title: "Pizza backen und Filmabend",
    size: "small",
    location: null,
    note: "ich bring den teig mit, du die filme!",
    organizer: 0,
    costEur: 18,
    reviews: [
      { who: 0, rating: 5, note: "Der Teig war perfekt, der Film eher nicht 😅", again: "yes" },
      { who: 1, rating: 4, note: "Nächstes Mal such ich den Film aus.", again: "yes" },
    ],
    tasks: [
      { title: "Mehl und Hefe kaufen", done: true },
      { title: "Filme raussuchen", done: true },
    ],
    photos: 2,
  },
  {
    weeksAgo: 4,
    weekday: 6,
    hour: 11,
    hours: 6,
    title: "Wanderung im Siebengebirge",
    size: "large",
    location: "Drachenfels, Königswinter",
    note: "gute schuhe!! und wasser",
    organizer: 1,
    costEur: 25,
    reviews: [
      { who: 0, rating: 4, note: "Oben war die Aussicht der Hammer.", again: "maybe" },
      { who: 1, rating: 5, note: null, again: "yes" },
    ],
    tasks: [
      { title: "Wasser einpacken", done: true },
      { title: "Brote schmieren", done: false },
    ],
    photos: 3,
  },
  {
    weeksAgo: 5,
    weekday: 4,
    hour: 20,
    hours: 2,
    title: "Kino im Odeon",
    size: "small",
    location: "Odeon, Severinstraße",
    note: null,
    organizer: 0,
    costEur: 24,
    reviews: [{ who: 1, rating: 3, note: "Popcorn war besser als der Film.", again: "no" }],
    tasks: [],
    photos: 0,
  },
  {
    weeksAgo: 7,
    weekday: 7,
    hour: 10,
    hours: 3,
    title: "Flohmarkt in Ehrenfeld",
    size: "small",
    location: "Ehrenfeld, Venloer Straße",
    note: "wer zuerst ne alte kamera findet, gewinnt",
    organizer: 1,
    costEur: 12,
    reviews: [
      { who: 0, rating: 5, note: "Die Kamera steht jetzt im Regal 📷", again: "yes" },
      { who: 1, rating: 4, note: "Ich hab verloren. Revanche!", again: "yes" },
    ],
    tasks: [],
    photos: 1,
  },
  {
    weeksAgo: 8,
    weekday: 3,
    hour: 19,
    hours: 2,
    title: "Escape Room",
    size: "small",
    location: "Altstadt-Nord",
    note: null,
    organizer: 0,
    costEur: 60,
    reviews: [],
    tasks: [{ title: "Tickets buchen", done: true }],
    photos: 0,
  },
  {
    weeksAgo: 10,
    weekday: 5,
    hour: 18,
    hours: 3,
    title: "Picknick am Rhein",
    size: "small",
    location: "Rheinpark",
    note: "decke nicht vergessen",
    organizer: 1,
    costEur: 0,
    reviews: [
      { who: 0, rating: 4, note: null, again: "maybe" },
      { who: 1, rating: 5, note: "Sonnenuntergang über dem Dom 💛", again: "yes" },
    ],
    tasks: [],
    photos: 2,
  },
  {
    weeksAgo: 12,
    weekday: 6,
    hour: 15,
    hours: 4,
    title: "Museum Ludwig und Kaffee",
    size: "large",
    location: "Museum Ludwig",
    note: null,
    organizer: 0,
    costEur: 32,
    reviews: [
      { who: 0, rating: 3, note: "Zu voll, aber der Kuchen danach!", again: "maybe" },
      { who: 1, rating: 4, note: null, again: null },
    ],
    tasks: [],
    photos: 1,
  },
];

/** The rounds (weeks back) that fell through – a wilted leaf in the Archiv. */
export const DEMO_SKIPPED_WEEKS = [6];

export type DemoRound = { weeksAgo: number; startsAt: Date; endsAt: Date; date: (DemoDate & { startsAt: Date; endsAt: Date }) | null };

/** The weekly rounds to write for `now` (Monday to Monday, Berlin), oldest first. */
export function demoRounds(now: Date, zone = APP_TIMEZONE): DemoRound[] {
  const week = DateTime.fromJSDate(now, { zone }).startOf("week");
  const rounds: DemoRound[] = [
    ...DEMO_DATES.map((d) => ({ weeksAgo: d.weeksAgo, date: d })),
    ...DEMO_SKIPPED_WEEKS.map((weeksAgo) => ({ weeksAgo, date: null })),
  ].map(({ weeksAgo, date }) => {
    const start = week.minus({ weeks: weeksAgo });
    const at = date ? start.plus({ days: date.weekday - 1 }).set({ hour: date.hour, minute: date.minute ?? 0 }) : null;
    return {
      weeksAgo,
      startsAt: start.toJSDate(),
      endsAt: start.plus({ weeks: 1 }).toJSDate(),
      date: date && at ? { ...date, startsAt: at.toJSDate(), endsAt: at.plus({ hours: date.hours }).toJSDate() } : null,
    };
  });
  return rounds.sort((a, b) => b.weeksAgo - a.weeksAgo);
}

/** Never inside the "wie war's?" window – checked by the test, so a new entry cannot slip in. */
export const DEMO_MIN_AGE_DAYS = REVIEW_PROMPT_DAYS + 1;

const SCENES = [
  { sky: ["#F7C9A9", "#F2A7BB"], sun: "#FFE08A", hills: ["#8FC79A", "#4FA25E"] },
  { sky: ["#B9CDEB", "#DCE7F5"], sun: "#FFFFFF", hills: ["#6DBA74", "#2E7D46"] },
  { sky: ["#CBBFE6", "#F6DFD3"], sun: "#F2A7BB", hills: ["#E8A58D", "#8A6440"] },
  { sky: ["#163A22", "#2F4036"], sun: "#F7EBC4", hills: ["#4FA25E", "#1B2620"] },
];

/** A drawn stand-in photo (no real pictures in test data): a sky, a sun, two hills – `seed` picks the colors. */
export function demoPhotoSvg(seed: number): string {
  const s = SCENES[Math.abs(seed) % SCENES.length];
  const x = 200 + ((seed * 137) % 800);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="${x}" cy="300" r="110" fill="${s.sun}"/><path d="M0 640 Q300 470 620 610 T1200 560 V900 H0Z" fill="${s.hills[0]}"/><path d="M0 760 Q420 620 760 740 T1200 700 V900 H0Z" fill="${s.hills[1]}"/></svg>`;
}

/** The stored path of a drawn photo – the photo route draws it instead of reading a file. */
export const demoPhotoPath = (seed: number) => `demo/${seed}.svg`;

export function demoPhotoSeed(path: string): number | null {
  const m = /^demo\/(\d+)\.svg$/.exec(path);
  return m ? Number(m[1]) : null;
}
