const CACHE_NAME = 'neurogestor-cache-v2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(['/']);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Não interceptar requisições do Firebase (Firestore, Storage, Auth, etc.)
    if (
        url.includes('firestore.googleapis.com') ||
        url.includes('firebasestorage.googleapis.com') ||
        url.includes('firebase.googleapis.com') ||
        url.includes('firebaseinstallations.googleapis.com') ||
        url.includes('googleapis.com/google.firestore') ||
        url.includes('identitytoolkit.googleapis.com') ||
        url.includes('securetoken.googleapis.com') ||
        url.includes('fcm.googleapis.com') ||
        url.includes('content-firebasestorage.googleapis.com') ||
        event.request.method !== 'GET'
    ) {
        return;
    }

    // Cache-first para assets estáticos, network-first para o resto
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
