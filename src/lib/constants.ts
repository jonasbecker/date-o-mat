// Cookie names are shared between proxy.ts (edge of the request) and the
// server modules, so they live in a dependency-free file.
export const SESSION_COOKIE = "dom_session";
export const OAUTH_COOKIE = "dom_oauth";

export const SESSION_DAYS = 180;
export const INVITE_VALID_HOURS = 48;
