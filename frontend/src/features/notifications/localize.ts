import { getLang, translate } from '@/lib/i18n'
import { paymentMethodLabel } from '@/lib/labels'
import type { NotificationItem, PaymentMethod } from '@/types/api'

/**
 * Notifications are stored by the API in English (they are shared by every staff member).
 * This shows them in the portal language, e.g. "New order #1024 · Masa 07" → "Yeni sipariş #1024 · Masa 07".
 */
const months: Record<string, string> = {
  Jan: 'Oca', Feb: 'Şub', Mar: 'Mar', Apr: 'Nis', May: 'May', Jun: 'Haz',
  Jul: 'Tem', Aug: 'Ağu', Sep: 'Eyl', Oct: 'Eki', Nov: 'Kas', Dec: 'Ara',
}

const titleRules: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^New order #(\d+) · (.+)$/, (m) => translate('New order #{n} · {where}', { n: m[1], where: m[2] === 'Takeaway' ? translate('Takeaway') : m[2] })],
  [/^Payment received · #(\d+)$/, (m) => translate('Payment received · #{n}', { n: m[1] })],
  [/^Payment failed · #(\d+)$/, (m) => translate('Payment failed · #{n}', { n: m[1] })],
  [/^Low stock · (.+)$/, (m) => translate('Low stock · {name}', { name: m[1] })],
  [/^New reservation · (.+)$/, (m) => translate('New reservation · {name}', { name: m[1] })],
  [/^Welcome to (.+)$/, (m) => translate('Welcome to {name}', { name: m[1] })],
]

const messageRules: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Remaining: (.+) · Minimum: (.+)$/, (m) => translate('Remaining: {left} · Minimum: {min}', { left: m[1], min: m[2] })],
  [
    /^(\d{1,2}) (\w{3}) at (\d{2}:\d{2}) · (\d+) people$/,
    (m) => translate('{date} at {time} · {n} people', { date: `${m[1]} ${getLang() === 'tr' ? (months[m[2]] ?? m[2]) : m[2]}`, time: m[3], n: m[4] }),
  ],
  [/^([\d.,]+) (\w+) by (\w+)$/, (m) => translate('{amount} {currency} · {method}', { amount: m[1], currency: m[2], method: paymentMethodLabel(m[3] as PaymentMethod) })],
  [/^(Payment was declined\.|Card declined \(simulated failure\)\.|Your portal is ready\..*)$/, (m) => translate(m[1])],
]

function apply(text: string, rules: [RegExp, (m: RegExpMatchArray) => string][]) {
  for (const [pattern, format] of rules) {
    const match = text.match(pattern)
    if (match) return format(match)
  }
  return text
}

export function localizeNotification<T extends Pick<NotificationItem, 'title' | 'message'>>(n: T): T {
  return { ...n, title: apply(n.title, titleRules), message: apply(n.message, messageRules) }
}
