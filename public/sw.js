// Service worker: instant launches from cache, offline reading and a fallback page.
// Bump VERSION whenever the caching strategy or the shell assets change.
const VERSION = "v1";
const SHELL_CACHE = `tldr-shell-${VERSION}`;
const PAGE_CACHE = `tldr-pages-${VERSION}`;
const READER_CACHE = `tldr-reader-${VERSION}`;
const FONT_CACHE = `tldr-fonts-${VERSION}`;
const CACHES = [SHELL_CACHE, PAGE_CACHE, READER_CACHE, FONT_CACHE];

const SHELL_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/apple-touch-icon.png",
];
const MAX_READER_ENTRIES = 60;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("tldr-") && !CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

const isFeedPage = (url) =>
  /^\/[^/]+\.html$/.test(url.pathname) &&
  url.pathname !== "/index.html" &&
  url.pathname !== "/offline.html";

const isReaderPage = (url) =>
  url.pathname === "/reader" || url.pathname === "/article";

const isCacheable = (response) =>
  response &&
  response.status === 200 &&
  response.type === "basic" &&
  // Safari refuses redirected responses for navigations
  !response.redirected;

const putInCache = async (cacheName, key, response) => {
  if (!isCacheable(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(key, response);
};

const trimCache = async (cacheName, maxEntries) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - maxEntries)).map((key) => cache.delete(key)),
  );
};

const offlineResponse = async () =>
  (await caches.match("/offline.html")) ||
  new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });

const fetchFromNetwork = (event) => fetch(event.request);

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

// Feed pages: served from cache for an instant launch; the page itself refreshes
// in the background when its copy is stale (requests marked with X-Refresh).
const handleFeedPage = async (event, url) => {
  const key = url.href;
  const forceNetwork = event.request.headers.get("X-Refresh") === "1";
  const cached = forceNetwork ? null : await caches.match(key, { ignoreVary: true });
  if (cached) return cached;

  try {
    const network = fetchFromNetwork(event);
    const response = forceNetwork ? await network : await withTimeout(network, NETWORK_TIMEOUT_MS * 2);
    event.waitUntil(putInCache(PAGE_CACHE, key, response.clone()));
    return response;
  } catch (error) {
    if (forceNetwork) throw error;
    return offlineResponse();
  }
};

// Articles don't change: cache first, so previously opened ones load instantly and offline
const handleReaderPage = async (event, url) => {
  const key = url.href;
  const cached = await caches.match(key, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetchFromNetwork(event);
    event.waitUntil(
      putInCache(READER_CACHE, key, response.clone()).then(() =>
        trimCache(READER_CACHE, MAX_READER_ENTRIES),
      ),
    );
    return response;
  } catch (error) {
    return offlineResponse();
  }
};

const handleCacheFirst = async (event, cacheName) => {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  const response = await fetch(event.request);
  if (response.ok || response.type === "opaque") {
    const cache = await caches.open(cacheName);
    event.waitUntil(cache.put(event.request, response.clone()));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(handleCacheFirst(event, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (isFeedPage(url)) {
    event.respondWith(handleFeedPage(event, url));
    return;
  }

  if (isReaderPage(url)) {
    event.respondWith(handleReaderPage(event, url));
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/") || url.pathname === "/favicon.png") {
    event.respondWith(handleCacheFirst(event, SHELL_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetchFromNetwork(event).catch(() => offlineResponse()));
  }
});
