async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clearAllCaches()

      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      await self.registration.unregister()
      await Promise.all(clients.map((client) => client.navigate(client.url)))
    })(),
  )
})