import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self } from '$app/service-worker';

const CACHE_NAME = `cache-${version}`;
// Manifest paths are relative to the base path, which is the service worker's scope.
const ASSETS = [...immutable, ...assets].map(
  ({ path }) => new URL(path, self.registration.scope).pathname,
);

const API_CACHE_NAME = `api-cache-${version}`;

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // Built assets: cache-first (they are hashed by the build)
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // __data.json responses contain authenticated financial data and must never
  // be cached by the service worker. Let these requests go straight to the
  // network (no respondWith -> browser default handling, nothing stored).
  if (url.pathname.endsWith('/__data.json')) {
    return;
  }

  // Everything else (rendered pages included) may contain authenticated
  // data, so it is cached in the wipeable data cache — never in the
  // build-asset cache — and cleared on logout.
  event.respondWith(networkFirst(request));
});

// Clear cached pages/data when the user logs out to prevent data leakage
self.addEventListener('message', (event) => {
  if (event.data?.type === 'LOGOUT') {
    event.waitUntil?.(caches.delete(API_CACHE_NAME));
  }
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // For navigation requests, return the cached app shell
    if (request.mode === 'navigate') {
      const shell = await caches.match('/dashboard');
      if (shell) return shell;
    }

    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}
