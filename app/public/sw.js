// sw.js — minimal service worker, just enough to satisfy PWA
// installability criteria (a registered SW with a fetch handler).
// Deliberately does NOT cache anything — this app's data changes
// constantly (live telemetry, alerts), so an offline-first cache
// strategy would show stale numbers rather than a genuinely useful
// offline mode. This is a seam for that later, not a finished one:
// swap the fetch handler for a real caching strategy if/when true
// offline support is worth building.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
