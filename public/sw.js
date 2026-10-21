// Zweisamen service worker: shows push notifications and opens the app on tap – and keeps the app readable
// without network: every page you open is remembered (network first, so online it is always fresh); offline
// you get its last state (the start: the Beet; a page not seen yet: a friendly offline page). The app's code files never change
// under their name, so they come from the cache. Signing out (the login page) forgets the pages: they hold
// your data, on your phone only.

const CACHE = "dom-offline-v2";
const PAGES = "dom-pages-v1";
const STATIC = "dom-static-v1";
const KEEP = [CACHE, PAGES, STATIC];
const PAGE_LIMIT = 30;
/** Old versions' files pile up with every deploy – the oldest go. */
const STATIC_LIMIT = 400;
const OFFLINE_ASSETS = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!KEEP.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Keeps the page under its final address (a stored copy must not be a redirect), the oldest go first. */
async function remember(response) {
  const url = new URL(response.url);
  const cache = await caches.open(PAGES);
  const copy = new Response(await response.blob(), { status: 200, headers: { "content-type": response.headers.get("content-type") || "text/html" } });
  await cache.delete(url.href);
  await cache.put(url.href, copy);
  await trim(cache, PAGE_LIMIT);
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(old);
}

async function lastState(request) {
  const cache = await caches.open(PAGES);
  const url = new URL(request.url);
  return (
    (await cache.match(url.href, { ignoreVary: true })) ||
    (await cache.match(new URL(url.pathname, url.origin).href, { ignoreVary: true })) ||
    // The app's start ("/" leads to the Beet) – any other page not seen yet gets the offline page.
    (url.pathname === "/" && (await cache.match(new URL("/plan", url.origin).href, { ignoreVary: true }))) ||
    (await caches.match("/offline.html"))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const at = new URL(response.url || request.url);
          if (at.pathname === "/login") event.waitUntil(caches.delete(PAGES));
          else if (response.ok && at.origin === url.origin && !at.pathname.startsWith("/api/") && (response.headers.get("content-type") || "").includes("text/html")) {
            event.waitUntil(remember(response.clone()).catch(() => {}));
          }
          return response;
        } catch {
          return lastState(request);
        }
      })(),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  // The app's code, styles and fonts: a new version gets a new name, so the stored one is always right.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) event.waitUntil(cache.put(request, response.clone()).then(() => trim(cache, STATIC_LIMIT)));
        return response;
      })(),
    );
    return;
  }
  // The offline page's own image, served from the cache when the network is gone.
  if (OFFLINE_ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
});

/** The number on the app icon: what waits for you (the server counts it for every push). */
async function setBadge(count) {
  if (typeof count !== "number" || !self.navigator.setAppBadge) return;
  try {
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // no permission – nothing to show
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Zweisamen", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Zweisamen", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url: data.url || "/" },
      }),
      setBadge(data.badge),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
