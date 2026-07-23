// Cache-first service worker — precaches the app shell and Tabler Icons
// CDN assets on install, serves from cache, and cleans up stale caches
// on activate.
// See: https://github.com/smuelLuB/DailyDash/issues/6

/* ── CACHE CONFIG ────────────────────────────────────────────────── */
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'app-' + CACHE_VERSION;

// Precached URLs — installed atomically on the install event.
// If any URL fails the whole install aborts and the old SW keeps serving.
//
// The CDN font URLs below mirror the @font-face src declarations in
// tabler-icons.min.css. If bumping the Tabler Icons version, sync these
// against whatever the new CSS declares.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.9.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.9.0/dist/fonts/tabler-icons.woff2?v3.9.0',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.9.0/dist/fonts/tabler-icons.woff?',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.9.0/dist/fonts/tabler-icons.ttf?v3.9.0',
];

/* ── INSTALL ─────────────────────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ────────────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── MESSAGES — notification pipeline ──────────────────────────────── */
let waterTimer = null;
let waterNotificationOpts = null;
let shutdownTimer = null;
let shutdownNotificationOpts = null;

function swNextFireTime(from) {
  const d = new Date(from);
  const nineAM = new Date(d); nineAM.setHours(9, 0, 0, 0);
  const ninePM = new Date(d); ninePM.setHours(21, 0, 0, 0);

  if (d < nineAM) return nineAM.getTime();
  if (d >= ninePM) {
    const tomorrow9am = new Date(nineAM);
    tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    return tomorrow9am.getTime();
  }

  const msSince9am = d.getTime() - nineAM.getTime();
  const slotMs = 90 * 60 * 1000;
  const slots = Math.floor(msSince9am / slotMs);
  const next = nineAM.getTime() + (slots + 1) * slotMs;

  if (next > ninePM.getTime()) {
    const tomorrow9am = new Date(nineAM);
    tomorrow9am.setDate(tomorrow9am.getDate() + 1);
    return tomorrow9am.getTime();
  }
  return next;
}

function swScheduleWater(nextFireISO, opts) {
  if (waterTimer) { clearTimeout(waterTimer); waterTimer = null; }
  if (opts) waterNotificationOpts = opts;

  const fireAt = new Date(nextFireISO).getTime();
  const delay = Math.max(0, fireAt - Date.now());

  waterTimer = setTimeout(() => {
    self.registration.showNotification('DailyDash', waterNotificationOpts || {
      body: 'Time to hydrate! 💧',
      vibrate: [300, 150, 300],
      requireInteraction: true,
      icon: './icon-192.png',
      tag: 'water-reminder',
    }).catch(() => {});

    // Reschedule next 90-min slot
    const next = swNextFireTime(Date.now());
    const nextDay = new Date(next).toDateString();
    const today = new Date().toDateString();
    if (nextDay === today) {
      swScheduleWater(new Date(next).toISOString());
    }
  }, delay);
}

function swScheduleShutdown(nextFireISO, opts) {
  if (shutdownTimer) { clearTimeout(shutdownTimer); shutdownTimer = null; }
  if (opts) shutdownNotificationOpts = opts;

  const fireAt = new Date(nextFireISO).getTime();
  const delay = Math.max(0, fireAt - Date.now());

  shutdownTimer = setTimeout(() => {
    self.registration.showNotification('DailyDash', shutdownNotificationOpts || {
      body: 'Time to shut down for the day — tidy up, review, and plan for tomorrow 🌙',
      vibrate: [200, 200, 200, 200],
      requireInteraction: true,
      icon: './icon-192.png',
      tag: 'shutdown-reminder',
    }).catch(() => {});

    // Reschedule for same time tomorrow
    const next = new Date();
    next.setHours(21, 0, 0, 0);
    next.setDate(next.getDate() + 1);
    swScheduleShutdown(next.toISOString());
  }, delay);
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'show-test-notification') {
    self.registration.showNotification('DailyDash', {
      body: 'Test notification — heads-up + vibration',
      vibrate: [300, 150, 300],
      requireInteraction: true,
      icon: './icon-192.png',
      tag: 'test-notification',
    }).catch(() => {});
  }

  if (event.data && event.data.type === 'schedule-water') {
    swScheduleWater(event.data.nextFire, event.data.notificationOpts);
  }

  if (event.data && event.data.type === 'cancel-water') {
    if (waterTimer) { clearTimeout(waterTimer); waterTimer = null; }
  }

  if (event.data && event.data.type === 'schedule-shutdown') {
    swScheduleShutdown(event.data.nextFire, event.data.notificationOpts);
  }

  if (event.data && event.data.type === 'cancel-shutdown') {
    if (shutdownTimer) { clearTimeout(shutdownTimer); shutdownTimer = null; }
  }
});

/* ── FETCH ──────────────────────────────────────────────────────── */
// Network-first for navigation (HTML pages) so deploys take effect
// immediately — no cache-version bump needed for content changes.
// Cache-first for everything else (static assets, CDN) for speed +
// offline resilience.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, toCache)).catch(() => {});
        }
        return response;
      }).catch(() =>
        caches.match(event.request).then((cached) =>
          cached || new Response('Offline', { status: 503 })
        )
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)).catch(() => {});
        return response;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});
