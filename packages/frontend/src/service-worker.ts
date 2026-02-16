/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = `cache-${version}`;
const ASSETS = [...build, ...files];

const API_CACHE_NAME = `api-cache-${version}`;

self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
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
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
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

	// API data routes (SvelteKit internal data fetches): stale-while-revalidate
	if (url.pathname.endsWith('/__data.json')) {
		event.respondWith(staleWhileRevalidate(request, API_CACHE_NAME));
		return;
	}

	// Navigation requests (HTML pages): network-first
	if (request.mode === 'navigate') {
		event.respondWith(networkFirst(request));
		return;
	}

	// Everything else: network-first
	event.respondWith(networkFirst(request));
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
			const cache = await caches.open(CACHE_NAME);
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

async function staleWhileRevalidate(
	request: Request,
	cacheName: string
): Promise<Response> {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);

	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) {
				cache.put(request, response.clone());
			}
			return response;
		})
		.catch(() => cached ?? new Response('Offline', { status: 503 }));

	return cached ?? fetchPromise;
}
