/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API. Leave empty to use the same origin (Vite dev proxy / reverse proxy). */
  readonly VITE_API_BASE_URL?: string
  /** Set by vite.config.ts in development: this computer's network address, e.g. http://192.168.1.20:5173. */
  readonly VITE_LAN_ORIGIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
