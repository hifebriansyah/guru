// Guru service worker, served at <BASE_PATH>sw.js. scripts/postbuild.ts fills in VERSION and PRECACHE (Workbox's list of the build:
// the page shell and the hashed scripts and styles). Plain JavaScript on purpose: it is copied, not bundled.
// - install: save every precached file, then take over at once (the page shows "a new version is ready", see UpdatePrompt.tsx)
// - activate: delete every older "guru-" cache
// - pages: the network first, so a deploy shows at once; offline, the saved shell (it draws any address, a question's too)
// - everything else from this site: the saved copy first (hashed addresses never change)
// - other sites (the guru Worker, Google) are never cached: the answers always come live

const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `guru-${VERSION}`;
const scope = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(new Request(scope(url), { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("guru-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(new URL(scope("storybook/")).pathname)) return; // Storybook is never cached
  if (url.pathname.startsWith(new URL(scope("abism/")).pathname)) return; // the Kitab is read by the Worker, not by the page

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(scope("./"))) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
