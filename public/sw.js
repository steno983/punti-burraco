// Le due righe seguenti sono riscritte dal passo di post-build (scripts/build-sw.mjs)
// con l'impronta della build e l'elenco dei file prodotti, i cui nomi contengono un hash.
// Senza quel passo (sviluppo, dove il service worker non è registrato) restano questi
// valori: nessun precaricamento, ma il file resta valido e funzionante.
const BUILD_ID = 'sviluppo'
const PRECACHE = []

const CACHE_NAME = `punti-burraco-${BUILD_ID}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      // Un file irraggiungibile non deve impedire l'installazione: quel che manca
      // verrà messo in cache dal gestore di fetch alla prima richiesta utile.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  // Navigazione: prima la rete, così gli aggiornamenti arrivano; in mancanza di rete, la cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match(self.registration.scope))),
    )
    return
  }

  // Risorse statiche: prima la cache, poi la rete.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
