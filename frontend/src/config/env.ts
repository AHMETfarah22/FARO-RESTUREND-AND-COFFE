/**
 * Runtime configuration read from Vite env variables (frontend/.env).
 * Only VITE_* variables are exposed to the browser — never put secrets here.
 */
export const env = {
  /** Empty string = same origin (dev proxy / reverse proxy in production). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  appName: 'FARO RESTURENT AND COFFE',
  /** Where the demo's "Buy / contact" button points (https://wa.me/…, mailto:…). Empty hides the button. */
  demoContactUrl: import.meta.env.VITE_DEMO_CONTACT_URL ?? '',
} as const

/**
 * Demo build (`npm run build:demo`, published on GitHub Pages): the API runs inside the browser
 * (src/demo) with sample data kept in localStorage, so the portal works without a server.
 * `MODE` is replaced at build time, so the demo code is not part of the normal build.
 */
export const isDemo = import.meta.env.MODE === 'demo'
