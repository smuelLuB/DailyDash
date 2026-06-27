// Minimal service worker — exists only to satisfy PWA installability
// checks (e.g. Android "Add to Home screen" prompts). It does not cache
// anything, so the app still requires a network connection to load.
// Upgrade path: add a fetch handler + Cache Storage here if real offline
// support is wanted later.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
