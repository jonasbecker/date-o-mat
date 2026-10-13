// Google Calendar helpers without I/O.

const SCOPE = "https://www.googleapis.com/auth/";

/**
 * Minimal calendar access:
 * - events.freebusy: busy times of calendars you can see (incl. subscribed ones), no details
 * - calendarlist.readonly: names of your calendars, to pick which ones count as busy
 * - events.owned: create/change/delete events in calendars you own (the date invitation)
 */
export const CALENDAR_SCOPES = [
  `${SCOPE}calendar.events.freebusy`,
  `${SCOPE}calendar.calendarlist.readonly`,
  `${SCOPE}calendar.events.owned`,
] as const;

/** Google lets people untick single permissions – check that all were granted. */
export function missingCalendarScopes(grantedScope: string | null | undefined): string[] {
  const granted = new Set((grantedScope ?? "").split(/\s+/).filter(Boolean));
  return CALENDAR_SCOPES.filter((scope) => !granted.has(scope));
}

export type CalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  selected?: boolean;
  accessRole: string;
};

/** Calendars that only show holidays, birthdays or weather never block a date. */
export function isInformationalCalendar(id: string): boolean {
  return /#(holiday|contacts|weather)@group\.v\.calendar\.google\.com$/.test(id);
}

/** Default selection: the main calendar plus every calendar the person shows in Google Calendar. */
export function defaultBusyCalendarIds(calendars: CalendarListEntry[]): string[] {
  const ids = calendars
    .filter((c) => c.primary || (c.selected && !isInformationalCalendar(c.id)))
    .map((c) => (c.primary ? "primary" : c.id));
  return ids.includes("primary") ? ids : ["primary", ...ids];
}
