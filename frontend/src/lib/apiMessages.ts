import { translate, type Lang } from './i18n'

/*
 * The API writes its messages in English (they are also logged and used by other clients). These rules show them in
 * the page language: fixed messages are dictionary entries (i18n-tr.ts), messages with values are matched here.
 *   "Only 2 × Tiramisu left." → "Yalnızca 2 × Tiramisu kaldı."
 * Anything unknown is shown as the API wrote it.
 */

type Rule = [pattern: RegExp, template: string, values: (m: RegExpExecArray, lang: Lang) => Record<string, string>]

const status = (s: string, lang: Lang) => translate(`order|${s}`, undefined, lang)

const rules: Rule[] = [
  [/^(.+) '.+' was not found\.$/, '{entity} not found. It may have been deleted.', (m, lang) => ({ entity: translate(m[1], undefined, lang) })],
  [/^An order cannot move from (\w+) to (\w+)\.$/, 'An order cannot move from {from} to {to}.', (m, lang) => ({ from: status(m[1], lang), to: status(m[2], lang) })],
  [/^Your role cannot mark orders as (\w+)\.$/, 'Your role cannot mark orders as {status}.', (m, lang) => ({ status: status(m[1], lang) })],
  [/^(\w+) payments are disabled in settings\.$/, '{method} payments are disabled in settings.', (m, lang) => ({ method: translate(`method|${m[1]}`, undefined, lang) })],
  [/^Only (\d+) × (.+) left\.$/, 'Only {n} × {name} left.', (m) => ({ n: m[1], name: m[2] })],
  [/^(.+) is out of stock\.$/, '{name} is out of stock.', (m) => ({ name: m[1] })],
  [/^(.+) is currently unavailable\.$/, '{name} is currently unavailable.', (m) => ({ name: m[1] })],
  [/^(.+) is disabled\.$/, '{name} is disabled.', (m) => ({ name: m[1] })],
  [/^Amount exceeds the outstanding balance \((.+)\)\.$/, 'Amount exceeds the outstanding balance ({amount}).', (m) => ({ amount: m[1] })],
  [/^A category named '(.+)' already exists\.$/, "A category named '{name}' already exists.", (m) => ({ name: m[1] })],
  [/^SKU '(.+)' is already used by another product\.$/, "SKU '{sku}' is already used by another product.", (m) => ({ sku: m[1] })],
  [/^(.+) seats (\d+); the party has (\d+) people\.$/, '{table} seats {capacity}; the party has {n} people.', (m) => ({ table: m[1], capacity: m[2], n: m[3] })],
  [/^(.+) already has a reservation within 2 hours of (.+)\.$/, '{table} already has a reservation within 2 hours of {time}.', (m) => ({ table: m[1], time: m[2] })],
  [/^Only ([\d.]+) (\S+) of (.+) in stock\.$/, 'Only {quantity} {unit} of {name} in stock.', (m) => ({ quantity: m[1], unit: m[2], name: m[3] })],
  [/^(.+) already exists\.$/, '{name} already exists.', (m) => ({ name: m[1] })],
  [/^This license key was made for another computer \((.+)\)\. This computer's code is (.+)\.$/, "This license key was made for another computer ({other}). This computer's code is {code}.", (m) => ({ other: m[1], code: m[2] })],
  [/^This license key expired on (.+)\.$/, 'This license key expired on {date}.', (m) => ({ date: m[1] })],
  // FluentValidation's standard messages name the property in English; under a form field the field is obvious.
  [/^'.+' must not be empty\.$/, 'This field is required.', () => ({})],
  [/^'.+' is not a valid email address\.$/, 'Enter a valid email address.', () => ({})],
  [/^'.+' must be between ([\d.]+) and ([\d.]+)\..*$/, 'Enter a value between {min} and {max}.', (m) => ({ min: m[1], max: m[2] })],
  [/^'.+' must be greater than or equal to '([\d.]+)'\.$/, 'Enter a value of at least {min}.', (m) => ({ min: m[1] })],
  [/^'.+' must be greater than '([\d.]+)'\.$/, 'Enter a value greater than {min}.', (m) => ({ min: m[1] })],
  [/^The length of '.+' must be at least (\d+) characters\..*$/, 'Must be at least {n} characters.', (m) => ({ n: m[1] })],
  [/^The length of '.+' must be (\d+) characters or fewer\..*$/, 'Must be {n} characters or fewer.', (m) => ({ n: m[1] })],
  [/^'.+' must be (\d+) characters in length\..*$/, 'Must be exactly {n} characters.', (m) => ({ n: m[1] })],
]

/** An API message in the page language. English pages get the message unchanged. */
export function localizeApiMessage(message: string, lang: Lang): string {
  if (lang === 'en' || !message) return message
  const exact = translate(message, undefined, lang)
  if (exact !== message) return exact
  for (const [pattern, template, values] of rules) {
    const m = pattern.exec(message)
    if (m) return translate(template, values(m, lang), lang)
  }
  return message
}
