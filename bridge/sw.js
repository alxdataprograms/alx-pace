/**
 * Kill switch for the retired service worker at the app's old origin.
 *
 * Browsers re-fetch a registered service worker script periodically and on
 * navigation. Serving THIS file at the path the old worker occupied means any
 * device still holding the old registration installs a worker whose only job
 * is to delete every cache, unregister itself, and reload the page it controls
 * — which lands the learner on the bridge and sends them to the new address.
 *
 * The bridge page also unregisters directly. This is the belt to that braces:
 * it reaches devices that never successfully load the page because the old
 * worker was answering their navigations from a stale cache.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      for (const client of clients) client.navigate(client.url)
    })(),
  )
})

// No fetch handler at all: every request goes straight to the network, so the
// old cached app shell can never be served again.
