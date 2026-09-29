import axios, { AxiosError } from 'axios'
import { env } from '@/config/env'
import { localizeApiMessage } from './apiMessages'
import { translate, type Lang } from './i18n'

/** Language of the page being shown (staff portal or customer menu — each has its own TR / EN switch). */
const pageLang = (): Lang => (document.documentElement.lang === 'en' ? 'en' : 'tr')

const TOKEN_KEY = 'faro.auth'

/** Token storage. sessionStorage-like persistence via localStorage so staff stay signed in on shared tablets until logout/expiry. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable (private mode) — session lasts until reload */
    }
  },
}

/** Shared Axios instance for all API calls. */
export const api = axios.create({
  baseURL: `${env.apiBaseUrl}/api`,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
  // ?status=Pending&status=Confirmed (ASP.NET array binding)
  paramsSerializer: { indexes: null },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // The page language (staff or customer switch). The API still answers in English; getErrorMessage
  // shows its messages in this language (lib/apiMessages.ts).
  config.headers['Accept-Language'] = pageLang()
  return config
})

/** Called when the API rejects the session (expired/revoked token). Set by AuthProvider. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

/** Called when the API answers 402: this installation has no (valid) license. Set by LicenseGate. */
let onLicenseRequired: (() => void) | null = null
export function setLicenseRequiredHandler(handler: (() => void) | null) {
  onLicenseRequired = handler
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/login') || error.config?.url?.startsWith('/auth/register')
    if (error.response?.status === 401 && !isAuthCall && tokenStore.get()) onUnauthorized?.()
    if (error.response?.status === 402) onLicenseRequired?.()
    return Promise.reject(error)
  },
)

interface ProblemDetails {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

/** Turns any thrown value into a message that is safe to show in the UI. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    // No response, or a proxy/gateway reporting the API is unreachable.
    if (!error.response || [502, 503, 504].includes(error.response.status))
      return translate('Cannot reach the server. Is the API running?', undefined, pageLang())
    if (error.response.status === 402) return translate('This installation is not activated.', undefined, pageLang())
    if (error.response.status === 403) return translate('You do not have permission to do this.', undefined, pageLang())
    if (error.response.status === 429) return translate('Too many requests. Please wait a moment and try again.', undefined, pageLang())
    const data = error.response.data as ProblemDetails | undefined
    const firstFieldError = data?.errors && Object.values(data.errors)[0]?.[0]
    const message = firstFieldError ?? data?.detail ?? data?.title
    return message ? localizeApiMessage(message, pageLang()) : translate('Request failed ({status})', { status: error.response.status }, pageLang())
  }
  return error instanceof Error ? error.message : translate('Something went wrong.', undefined, pageLang())
}

/** Field-level validation errors (camelCase keys) from a 400 response. */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (error instanceof AxiosError && error.response?.status === 400) {
    const errors = (error.response.data as ProblemDetails | undefined)?.errors ?? {}
    return Object.fromEntries(
      Object.entries(errors).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), localizeApiMessage(v[0], pageLang())]),
    )
  }
  return {}
}

/** Downloads a file from an authenticated GET endpoint. */
export async function downloadFile(url: string, params?: Record<string, unknown>) {
  const response = await api.get<Blob>(url, { params, responseType: 'blob', timeout: 60_000 })
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  const fileName = match ? decodeURIComponent(match[1]) : 'download'

  const href = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
