// In development, always fetch from the network and do not enable offline support.
// This is because caching would make development more difficult.
self.addEventListener('fetch', event => {
    if (event.request.method === 'POST' && event.request.url.includes('/share-target')) {
        event.respondWith((async () => {
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
});
