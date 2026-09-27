import { localeFor, translate } from './i18n'

const currencyFormatters = new Map<string, Intl.NumberFormat>()

/** ₺1.250,00 style money. Currency comes from the restaurant settings; the format follows the portal language. */
export function formatMoney(value: number, currency = 'TRY', options: { compact?: boolean } = {}) {
  const locale = localeFor()
  const key = `${locale}-${currency}-${options.compact ? 'c' : 'f'}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: options.compact ? 0 : 2,
      minimumFractionDigits: options.compact ? 0 : 2,
    })
    currencyFormatters.set(key, formatter)
  }
  return formatter.format(value)
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat(localeFor(), { maximumFractionDigits: digits }).format(value)
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(localeFor(), { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString(localeFor(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString(localeFor(), { hour: '2-digit', minute: '2-digit' })
}

/** "2026-09-26" → "26 Eyl 2026" without timezone shifts. */
export function formatDateOnly(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return formatDate(new Date(y, m - 1, d))
}

/** "19:30:00" → "19:30" */
export function formatTimeOnly(value: string) {
  return value.slice(0, 5)
}

/** "Saturday 26 September" / "26 Eylül Cumartesi" */
export function formatLongDate(value: Date = new Date()) {
  return value.toLocaleDateString(localeFor(), { weekday: 'long', day: 'numeric', month: 'long' })
}

export function timeAgo(value: string | Date, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000))
  if (seconds < 60) return translate('just now')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return translate('{n} min ago', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return translate('{n} h ago', { n: hours })
  const days = Math.floor(hours / 24)
  return translate('{n} d ago', { n: days })
}

/** Minutes elapsed since a timestamp (kitchen ticket timers). */
export function minutesSince(value: string | Date, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000))
}

/** Local calendar date as yyyy-MM-dd. */
export function toIsoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

/** Splits "SuperAdmin" → "Super Admin", "QrMenu" → "Qr Menu". */
export function humanize(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2')
}
