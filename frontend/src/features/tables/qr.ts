import type { Restaurant } from '@/types/api'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** True when the address only works on this computer (a phone scanning it would fail). */
export function isLocalOnly(url: string) {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Base address encoded in QR codes, in order of preference:
 * 1. the public base URL from Settings → QR,
 * 2. in development, this computer's network address when the portal is opened via localhost,
 * 3. the address the portal is currently opened with (including a sub-path such as GitHub Pages' /repo-name).
 */
export function publicOrigin(restaurant: Restaurant | null) {
  const configured = restaurant?.settings.qrMenuBaseUrl?.trim().replace(/\/$/, '')
  if (configured) return configured
  if (LOCAL_HOSTS.includes(window.location.hostname) && import.meta.env.VITE_LAN_ORIGIN) return import.meta.env.VITE_LAN_ORIGIN
  return window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, '')
}

/** Public QR-menu URL for a table. */
export function menuUrl(tableId: string, restaurant: Restaurant | null) {
  return `${publicOrigin(restaurant)}/menu/table/${tableId}`
}

/** Saves a rendered QR <canvas> as a PNG file. */
export function downloadCanvas(canvas: HTMLCanvasElement | null, fileName: string) {
  if (!canvas) return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = fileName
  link.click()
}
