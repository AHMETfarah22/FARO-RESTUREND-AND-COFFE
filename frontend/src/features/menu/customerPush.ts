import { api } from '@/lib/api'

/**
 * Customer "order ready" notifications.
 *
 * - System notifications (Web Push) need a secure context (HTTPS, or localhost) and a service worker.
 *   With them the phone is notified even when the page is closed or the screen is locked.
 * - Everywhere else the order page alerts in-page (overlay, vibration, sound) while it is open.
 */

const SW_URL = '/sw.js'
const SW_SCOPE = '/menu/'

export type PushSupport = 'supported' | 'insecure' | 'unsupported'

export function pushSupport(): PushSupport {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return window.isSecureContext ? 'unsupported' : 'insecure'
  if (!window.isSecureContext) return 'insecure'
  return 'PushManager' in window ? 'supported' : 'unsupported'
}

export function notificationPermission(): NotificationPermission | 'unavailable' {
  return 'Notification' in window ? Notification.permission : 'unavailable'
}

/** Adds the customer web-app manifest (home-screen install; required for push on iPhone). */
export function addCustomerManifest() {
  if (document.querySelector('link[rel="manifest"]')) return
  const link = document.createElement('link')
  link.rel = 'manifest'
  link.href = '/menu.webmanifest'
  document.head.appendChild(link)
}

const COVER_KEY = 'faro.menu.cover'

/** Remembers the restaurant's cover photo so "My orders" can show it without loading the whole menu. */
export function cacheCover(url: string | null) {
  try {
    if (url) localStorage.setItem(COVER_KEY, url)
  } catch {
    /* ignore */
  }
}

export function readCachedCover(): string | null {
  try {
    return localStorage.getItem(COVER_KEY)
  } catch {
    return null
  }
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SW_SCOPE)) ?? navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE })
}

let publicKeyCache: Promise<string | null> | null = null
function publicKey() {
  publicKeyCache ??= api
    .get<{ publicKey: string | null }>('/menu/push/public-key')
    .then((r) => r.data.publicKey)
    .catch(() => null)
  return publicKeyCache
}

function base64UrlToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const key = await publicKey()
  if (!key) return null
  const reg = await registration()
  await navigator.serviceWorker.ready
  return (
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(key) }))
  )
}

async function sendSubscription(orderId: string, subscription: PushSubscription) {
  const json = subscription.toJSON()
  await api.post(`/menu/orders/${orderId}/push-subscription`, { endpoint: json.endpoint, keys: json.keys })
}

/**
 * Asks for permission (must be called from a tap) and subscribes the given orders.
 * Returns the resulting permission state.
 */
export async function enableOrderNotifications(orderIds: string[]): Promise<NotificationPermission | 'unavailable'> {
  if (pushSupport() !== 'supported') return notificationPermission()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  const subscription = await currentSubscription()
  if (subscription) await Promise.allSettled(orderIds.map((id) => sendSubscription(id, subscription)))
  return permission
}

/** Silently subscribes a newly placed order when the customer already allowed notifications. */
export async function subscribeOrderIfAllowed(orderId: string) {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return
  try {
    const subscription = await currentSubscription()
    if (subscription) await sendSubscription(orderId, subscription)
  } catch {
    /* in-page alerts still work */
  }
}

/** Shows a system notification from the page (used when the tab is in the background and push isn't set up). */
export async function showLocalNotification(title: string, body: string, tag: string) {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return
  try {
    const reg = await registration()
    await reg.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: '/menu/orders' } })
  } catch {
    /* ignore */
  }
}
