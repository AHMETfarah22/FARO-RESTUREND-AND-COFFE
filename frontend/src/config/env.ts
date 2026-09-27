/**
 * Runtime configuration read from Vite env variables (frontend/.env).
 * Only VITE_* variables are exposed to the browser — never put secrets here.
 */
export const env = {
  /** Empty string = same origin (dev proxy / reverse proxy in production). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  appName: 'FARO RESTURENT AND COFFE',
} as const
