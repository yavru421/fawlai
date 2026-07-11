// Caution! Be sure you understand the caveats before publishing an application with
// offline support. See https://aka.ms/blazor-offline-considerations

self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/ ];
const offlineAssetsExclude = [ /^service-worker\.js$/ ];

// Replace with your base path if you are hosting on a subfolder. Ensure there is a trailing '/'.
const base = "/";
const baseUrl = new URL(base, self.origin);
const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

async function onInstall(event) {
    console.info('Service worker: Install');
    self.skipWaiting();

    // Fetch and cache all matching items from the assets manifest
    const assetsRequests = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
        .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
    
    const cache = await caches.open(cacheName);
    
    // Cloudflare redirect fix: fetch each asset, strip the redirected flag if set, and put it in cache
    for (const request of assetsRequests) {
        try {
            const response = await fetch(request);
            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }
            const cleanResponse = response.redirected
                ? new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                })
                : response;
            await cache.put(request, cleanResponse);
        } catch (error) {
            console.error(`Failed to cache asset ${request.url}:`, error);
        }
    }
}

async function onActivate(event) {
    console.info('Service worker: Activate');
    await self.clients.claim();

    // Delete unused caches
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));
}

async function onFetch(event) {
    if (event.request.method === 'POST' && event.request.url.includes('/share-target')) {
        return event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const files = formData.getAll('images');
                
                if (files && files.length > 0) {
                    await new Promise((resolve, reject) => {
                        const request = indexedDB.open('ShotStackDB', 1);
                        request.onupgradeneeded = (e) => {
                            const db = e.target.result;
                            if (!db.objectStoreNames.contains('SharedFiles')) {
                                db.createObjectStore('SharedFiles', { keyPath: 'id' });
                            }
                        };
                        request.onsuccess = async (e) => {
                            const db = e.target.result;
                            const tx = db.transaction('SharedFiles', 'readwrite');
                            const store = tx.objectStore('SharedFiles');
                            
                            // Convert files to base64
                            let i = 0;
                            for (const file of files) {
                                const buffer = await file.arrayBuffer();
                                const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                                store.put({
                                    id: `shared_${Date.now()}_${i++}`,
                                    name: file.name,
                                    type: file.type,
                                    Base64Data: base64Data
                                });
                            }
                            tx.oncomplete = () => resolve();
                        };
                        request.onerror = (e) => reject(e);
                    });
                }
            } catch (err) {
                console.error('Web Share Target error:', err);
            }
            return Response.redirect('/editor?shared=true', 303);
        })());
    }

    let cachedResponse = null;
    if (event.request.method === 'GET') {
        const shouldServeIndexHtml = event.request.mode === 'navigate'
            && !manifestUrlList.some(url => url === event.request.url);

        const request = shouldServeIndexHtml ? 'index.html' : event.request;
        const cache = await caches.open(cacheName);
        cachedResponse = await cache.match(request);
    }

    return cachedResponse || fetch(event.request);
}
