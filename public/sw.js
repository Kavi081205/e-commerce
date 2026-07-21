/**
 * SMKP Traders — Service Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy:
 *  • navigation requests (HTML) → Network-first (always fresh after deploy)
 *  • Vite hashed assets (/assets/*) → Cache-first (safe: hashes change per deploy)
 *  • API calls → Network-only (never cache API responses)
 *  • Fonts / images → Stale-while-revalidate
 *
 * Cache invalidation:
 *  Each new deploy gets a new SW file (Vercel CDN busts it via ETag).
 *  On `activate`, old versioned caches are deleted automatically.
 *
 * Update UX:
 *  The app sends `{type: 'SKIP_WAITING'}` to trigger immediate takeover.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Bump this string on every deploy (Vite does it automatically via file hash
// changes, but keeping a manual version makes debugging easier).
const CACHE_VERSION = 'smkp-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGE_CACHE   = `${CACHE_VERSION}-images`;
const FONT_CACHE    = `${CACHE_VERSION}-fonts`;

const ALL_CACHES = [STATIC_CACHE, IMAGE_CACHE, FONT_CACHE];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so the new SW takes over immediately when SKIP_WAITING is sent.
  // We do NOT call skipWaiting() here unconditionally to avoid disrupting
  // an active session; instead the app explicitly triggers it via postMessage.
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Pre-cache only the shell — Vite-hashed assets are cached on first use.
      cache.addAll(['/'])
    )
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ── Message handler ───────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING — activating new version.');
    self.skipWaiting();
  }
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept non-GET or cross-origin requests (e.g., Firebase, Razorpay)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 2. Never cache API calls
  if (url.pathname.startsWith('/api/')) return;

  // 3. Vite hashed assets → cache-first (safe because hash changes every build)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4. Google Fonts → cache-first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // 5. Product/category images from Cloudinary → stale-while-revalidate
  if (
    url.hostname === 'res.cloudinary.com' ||
    url.hostname === 'firebasestorage.googleapis.com'
  ) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 6. HTML navigation → network-first (ensures latest index.html after deploy)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 7. Everything else → network-first with cache fallback
  event.respondWith(networkFirst(request));
});

// ── Strategy: Cache-First ─────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Network-First ───────────────────────────────────────────────────
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── Strategy: Stale-While-Revalidate ─────────────────────────────────────────
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await networkFetch;
}
