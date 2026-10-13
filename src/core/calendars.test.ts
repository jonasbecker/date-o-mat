import { describe, expect, it } from "vitest";
import { CALENDAR_SCOPES, defaultBusyCalendarIds, missingCalendarScopes } from "./calendars";

describe("missingCalendarScopes", () => {
  it("is empty when everything was granted", () => {
    expect(missingCalendarScopes(`openid email ${CALENDAR_SCOPES.join(" ")}`)).toEqual([]);
  });

  it("lists scopes the person unticked", () => {
    const granted = `openid ${CALENDAR_SCOPES[0]}`;
    expect(missingCalendarScopes(granted)).toEqual([CALENDAR_SCOPES[1], CALENDAR_SCOPES[2]]);
  });

  it("treats a missing scope string as nothing granted", () => {
    expect(missingCalendarScopes(undefined)).toHaveLength(CALENDAR_SCOPES.length);
  });
});

describe("defaultBusyCalendarIds", () => {
  it("takes the primary calendar and visible calendars, but not holidays or birthdays", () => {
    const ids = defaultBusyCalendarIds([
      { id: "jonas@gmail.com", summary: "Jonas", primary: true, selected: true, accessRole: "owner" },
      { id: "abc123@import.calendar.google.com", summary: "Uni", selected: true, accessRole: "reader" },
      { id: "hidden@group.calendar.google.com", summary: "Alt", selected: false, accessRole: "owner" },
      { id: "de.german#holiday@group.v.calendar.google.com", summary: "Feiertage", selected: true, accessRole: "reader" },
      { id: "addressbook#contacts@group.v.calendar.google.com", summary: "Geburtstage", selected: true, accessRole: "reader" },
    ]);
    expect(ids).toEqual(["primary", "abc123@import.calendar.google.com"]);
  });

  it("always includes the primary calendar", () => {
    expect(defaultBusyCalendarIds([])).toEqual(["primary"]);
  });
});
