import { toIsoDate } from '@/lib/format'
import type { OrderRow } from './db'

/** Money is rounded like the API (2 decimals, half away from zero). */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const sum = (values: number[]) => values.reduce((total, v) => total + v, 0)

/** Random v4 UUID (crypto.randomUUID needs HTTPS; this also works over a plain-http Wi-Fi address). */
export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** "Masa 07" — same wording as DiningTable.DisplayName. */
export const tableName = (number: number) => `Masa ${String(number).padStart(2, '0')}`

/** Local calendar date (yyyy-MM-dd) of a UTC timestamp. */
export const localDate = (iso: string) => toIsoDate(new Date(iso))

/** Order.RecalculateTotals(): tax is applied after the discount. */
export function recalculate(order: OrderRow) {
  order.subtotal = round2(sum(order.items.map((i) => i.unitPrice * i.quantity)))
  if (order.discount > order.subtotal) order.discount = order.subtotal
  order.taxAmount = round2(((order.subtotal - order.discount) * order.taxRate) / 100)
  order.total = round2(order.subtotal - order.discount + order.taxAmount)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Month abbreviation as .NET formats "MMM" with the invariant culture. */
export const shortMonth = (date: Date) => MONTHS[date.getMonth()]
