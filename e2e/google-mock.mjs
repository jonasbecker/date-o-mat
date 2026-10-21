// Minimal stand-in for the Google Calendar API (calendarList + freeBusy).
import { createServer } from "node:http";
import { DateTime } from "luxon";

const ZONE = "Europe/Berlin";
export const requests = [];
/** Events per calendar owner token: id → event. */
export const events = { "token-jonas": new Map(), "token-sam": new Map() };
/** Set to a number to make the next N event writes fail with that HTTP status. */
export const failures = { status: 0, count: 0 };

// Busy times relative to "next Friday" so the test works on any day.
function nextWeekday(weekday) {
  let d = DateTime.now().setZone(ZONE).startOf("day").plus({ days: 1 });
  while (d.weekday !== weekday) d = d.plus({ days: 1 });
  return d;
}
const friday = nextWeekday(5);
const saturday = nextWeekday(6);
const wednesday = nextWeekday(3);
const iso = (d) => d.toUTC().toISO();

export const BUSY = {
  "token-jonas": {
    primary: [{ start: iso(friday.set({ hour: 9 })), end: iso(friday.set({ hour: 17 })) }],
    "uni123@import.calendar.google.com": [{ start: iso(wednesday.set({ hour: 18 })), end: iso(wednesday.set({ hour: 21, minute: 30 })) }],
  },
  "token-sam": {
    // all-day busy event → midnight to midnight
    primary: [{ start: iso(saturday), end: iso(saturday.plus({ days: 1 })) }],
  },
};
export const DAYS = { friday, saturday, wednesday };

const CALENDARS = {
  "token-jonas": [
    { id: "jonas@example.com", summary: "Jonas", primary: true, selected: true, accessRole: "owner" },
    { id: "uni123@import.calendar.google.com", summary: "Uni-Stundenplan", selected: true, accessRole: "reader" },
    { id: "de.german#holiday@group.v.calendar.google.com", summary: "Feiertage in Deutschland", selected: true, accessRole: "reader" },
  ],
  "token-sam": [{ id: "sam@example.com", summary: "Sam", primary: true, selected: true, accessRole: "owner" }],
};

export function startMock(port = 4010) {
  const server = createServer((req, res) => {
    const token = (req.headers.authorization ?? "").replace("Bearer ", "");
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      // OAuth token endpoint (GOOGLE_OAUTH_TOKEN_URL): "revoked-refresh" behaves like a revoked grant,
      // everything else like Google with fake client credentials.
      if (req.url === "/token") {
        const form = new URLSearchParams(body);
        requests.push({ method: req.method, url: req.url, token: null, body: Object.fromEntries(form) });
        res.statusCode = form.get("refresh_token") === "revoked-refresh" ? 400 : 401;
        return res.end(JSON.stringify(res.statusCode === 400 ? { error: "invalid_grant", error_description: "Token has been expired or revoked." } : { error: "invalid_client" }));
      }
      requests.push({ method: req.method, url: req.url, token, body: body ? JSON.parse(body) : null });
      if (!BUSY[token]) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: { code: 401, message: "Invalid Credentials" } }));
      }
      if (req.url.startsWith("/calendar/v3/users/me/calendarList")) {
        return res.end(JSON.stringify({ items: CALENDARS[token] }));
      }
      if (req.url === "/calendar/v3/freeBusy" && req.method === "POST") {
        const { items } = JSON.parse(body);
        const calendars = Object.fromEntries(
          items.map(({ id }) => [id, BUSY[token][id] ? { busy: BUSY[token][id] } : id === "primary" ? { busy: [] } : { errors: [{ reason: "notFound" }], busy: [] }]),
        );
        return res.end(JSON.stringify({ kind: "calendar#freeBusy", calendars }));
      }
      const match = /^\/calendar\/v3\/calendars\/primary\/events(?:\/([a-v0-9]+))?(?:\?.*)?$/.exec(req.url);
      if (match) {
        const store = events[token];
        const id = match[1];
        if (failures.count > 0 && req.method !== "GET") {
          failures.count--;
          res.statusCode = failures.status;
          return res.end(JSON.stringify({ error: { message: "simulated failure" } }));
        }
        if (req.method === "POST") {
          const event = JSON.parse(body);
          if (store.has(event.id)) {
            res.statusCode = 409;
            return res.end(JSON.stringify({ error: { message: "duplicate" } }));
          }
          store.set(event.id, { ...event, status: "confirmed", attendees: event.attendees.map((a) => ({ ...a, responseStatus: "needsAction" })) });
          return res.end(JSON.stringify(store.get(event.id)));
        }
        if (!store.has(id)) {
          res.statusCode = 404;
          return res.end("{}");
        }
        if (req.method === "PATCH") {
          const patch = JSON.parse(body);
          const prev = store.get(id);
          const attendees = patch.attendees ? patch.attendees.map((a) => ({ ...a, responseStatus: a.responseStatus ?? prev.attendees.find((p) => p.email === a.email)?.responseStatus ?? "needsAction" })) : prev.attendees;
          store.set(id, { ...prev, ...patch, attendees });
          return res.end(JSON.stringify(store.get(id)));
        }
        if (req.method === "DELETE") {
          store.set(id, { ...store.get(id), status: "cancelled" });
          res.statusCode = 204;
          return res.end();
        }
        return res.end(JSON.stringify(store.get(id)));
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
