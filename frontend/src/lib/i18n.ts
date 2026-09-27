import { useSyncExternalStore } from 'react'
import { tr } from './i18n-tr'

/**
 * Portal language (staff pages). Turkish by default; English is available from the TR / EN switch.
 *
 * Texts are written in English in the code and looked up in the Turkish dictionary (i18n-tr.ts):
 *   t('New order')                    → "Yeni sipariş"
 *   t('Order #{number}', { number })  → "Sipariş #1024"
 *   t('table|Available')              → "Boş" (text before "|" is only a context for words with several meanings)
 */
export type Lang = 'tr' | 'en'
export type Vars = Record<string, string | number>

const KEY = 'faro.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'tr' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  return 'tr'
}

let current: Lang = initialLang()
const listeners = new Set<() => void>()
const missing = new Set<string>()

export function getLang() {
  return current
}

export function setLang(lang: Lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function translate(text: string, vars?: Vars, lang: Lang = current): string {
  let out = text.includes('|') ? text.slice(text.indexOf('|') + 1) : text
  if (lang === 'tr') {
    const hit = tr[text]
    if (hit !== undefined) out = hit
    else if (import.meta.env.DEV && !missing.has(text)) {
      // Lets us spot untranslated texts during development: window.__i18nMissing
      missing.add(text)
      ;(window as unknown as { __i18nMissing: string[] }).__i18nMissing = [...missing]
    }
  }
  return vars ? out.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : out
}

export type Translate = (text: string, vars?: Vars) => string

/** Current language + `t()`; re-renders when the language changes. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  const t: Translate = (text, vars) => translate(text, vars, lang)
  return { lang, setLang, t }
}

/** Intl locale for dates and numbers. */
export function localeFor(lang: Lang = current) {
  return lang === 'tr' ? 'tr-TR' : 'en-GB'
}
