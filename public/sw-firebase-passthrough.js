/**
 * sw-firebase-passthrough.js
 *
 * Minimal service worker for Bahi.
 * Passes ALL Firebase, auth, and external API calls straight through —
 * never caches or intercepts them. This fixes the bug where the SW was
 * intercepting Firebase SDK network calls in Capacitor WebView.
 *
 * Place this file in: public/sw-firebase-passthrough.js
 * Register it from: src/lib/registerSW.ts (see below)
 */

const CACHE_NAME = "bahi-v1";

// URLs that must NEVER be intercepted — pass directly to network
const PASSTHROUGH_PATTERNS = [
  /firestore\.googleapis\.com/,
  /firebase\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /firebaseapp\.com/,
  /googleapis\.com/,
  /wa\.me/,
  /whatsapp/,
];

function shouldPassthrough(url) {
  return PASSTHROUGH_PATTERNS.some((pattern) => pattern.test(url));
}

// ── Install: skip waiting so new SW activates immediately ────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

// ── Activate: claim all clients immediately ───────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: passthrough Firebase, cache-first for app shell ───────────────────
self.addEventListener("fetch", (event) => {
  const { url, method } = event.request;

  // Always passthrough non-GET and Firebase/external URLs
  if (method !== "GET" || shouldPassthrough(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For local app assets: network-first with cache fallback
  // (ensures fresh builds always load, offline falls back to cache)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful, same-origin responses
        if (
          response.ok &&
          response.type === "basic" &&
          !url.includes("hot-update")
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Network failed → try cache
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Nothing cached either — return offline fallback for navigation
        if (event.request.mode === "navigate") {
          const indexCache = await caches.match("/index.html");
          if (indexCache) return indexCache;
        }
        // Give up
        return new Response("Offline", { status: 503 });
      }),
  );
});
