// Minimal service worker — enables PWA install + offline fallback for shell
const CACHE_NAME = 'xhs-dashboard-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon.svg', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Skip non-GET and non-http
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;
  // Skip API calls (Claude/OpenAI/Gemini/Supabase) — always go to network
  const url = new URL(request.url);
  if (
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }
  // Network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
