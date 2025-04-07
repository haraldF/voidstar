/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('v1').then(cache => {
            return cache.addAll([
                '/index.html',
                '/main.js',
                '/service-worker.js',
                '/manifest.json',
                '/apple-touch-icon.png',
                '/favicon.ico',
                '/icon-192x192.png',
                '/icon-512x512.png',
                '/assets/sounds/explosion.mp3',
                '/assets/sounds/torpedo.mp3',
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response ?? fetch(event.request);
        })
    );
});