/* FARO RESTURENT AND COFFE — customer service worker (scope <base>/menu/).
 * Shows "order ready" push notifications even when the menu page is closed or the phone is locked. */

/* The portal may live in a sub-folder (e.g. GitHub Pages' /repo-name/), so paths are derived from the scope. */
const MENU = self.registration.scope // …/menu/
const BASE = MENU.replace(/menu\/$/, '')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

/* Turkish wording; the page stores the guest's TR / EN choice in Cache Storage (faro-prefs). */
const turkish = {
  Ready: (n, table) => ['Siparişiniz hazır! 🍽️', `Sipariş #${n}${table ? ' · ' + table : ''} hazır. Afiyet olsun!`],
  Preparing: (n) => [`Sipariş #${n} hazırlanıyor`, 'Mutfak siparişinizi hazırlamaya başladı.'],
  Cancelled: (n) => [`Sipariş #${n} iptal edildi`, 'Lütfen garsondan yardım isteyin.'],
}

async function guestLanguage() {
  try {
    const saved = await (await caches.open('faro-prefs')).match('/menu/__lang')
    if (saved) return await saved.text()
  } catch {
    /* no cache storage */
  }
  return (self.navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

async function show(data) {
  let title = data.title || 'FARO RESTURENT AND COFFE'
  let body = data.body || ''
  if (data.number && turkish[data.status] && (await guestLanguage()) === 'tr') [title, body] = turkish[data.status](data.number, data.table)

  await self.registration.showNotification(title, {
    body,
    icon: BASE + 'icons/icon-192.png',
    badge: BASE + 'icons/badge-96.png',
    tag: data.tag,
    renotify: true,
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: data.status === 'Ready',
    data: { url: data.url || MENU + 'orders' },
  })
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(show(data))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || MENU + 'orders', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(MENU)) {
          await client.focus()
          if ('navigate' in client) await client.navigate(url)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
