import { AxiosError, AxiosHeaders, CanceledError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { setHubFactory } from '@/features/realtime/hub'
import { api } from '@/lib/api'
import './api/auth'
import './api/business'
import './api/menu'
import './api/orders'
import './api/reports'
import './api/restaurant'
import { transaction } from './db'
import { DemoFile, HttpError, match, type Query } from './http'
import { createDemoHub } from './hub'

/*
 * Demo build: every /api call is answered inside the browser by the handlers in ./api (a TypeScript port of the
 * ASP.NET Core services) and SignalR is replaced by an in-browser hub. The pages themselves are unchanged.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown, headers: Record<string, string> = {}): AxiosResponse {
  return { data, status, statusText: status === 204 ? 'No Content' : 'OK', headers: new AxiosHeaders(headers), config, request: {} }
}

function failure(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const response: AxiosResponse = { data, status, statusText: String(status), headers: new AxiosHeaders({ 'content-type': 'application/problem+json' }), config, request: {} }
  return new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response)
}

/** Path (relative to /api) and query, including axios `params` (arrays repeat the key, like ?status=A&status=B). */
function parse(config: InternalAxiosRequestConfig) {
  const url = new URL(config.url ?? '', 'http://demo')
  const query: Query = {}
  const add = (key: string, value: string) => {
    const existing = query[key]
    query[key] = existing === undefined ? value : [...(Array.isArray(existing) ? existing : [existing]), value]
  }
  url.searchParams.forEach((value, key) => add(key, value))
  for (const [key, value] of Object.entries((config.params ?? {}) as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue
    for (const v of Array.isArray(value) ? value : [value]) add(key, String(v))
  }
  return { path: url.pathname, query }
}

const demoAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase()
  const { path, query } = parse(config)
  // A short, realistic delay; card payments take a little longer, like the simulated gateway.
  await wait(80 + Math.random() * 170 + (method === 'POST' && path === '/payments' ? 300 : 0))
  if (config.signal?.aborted) throw new CanceledError(undefined, undefined, config)

  const auth = config.headers.get('Authorization')
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null
  let body: unknown = config.data
  if (typeof body === 'string' && body !== '') {
    try {
      body = JSON.parse(body)
    } catch {
      /* not JSON */
    }
  }

  try {
    const found = match(method, path)
    if (!found) throw new HttpError(404, '')
    const request = { method, path, params: found.params, query, body, token }
    // Reads run directly; changes run as a transaction (saved on success, rolled back on error).
    const result = method === 'GET' ? found.handler(request) : transaction(() => found.handler(request))

    if (result instanceof DemoFile)
      return respond(config, 200, result.content, {
        'content-type': result.content.type,
        'content-disposition': `attachment; filename="${result.fileName}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      })
    if (result === undefined) return respond(config, 204, '')
    // Like JSON over the wire: the page gets its own copy, never the stored rows.
    return respond(config, 200, structuredClone(result))
  } catch (error) {
    if (!(error instanceof HttpError)) {
      console.error('[demo api]', method, path, error)
      throw failure(config, 500, { title: 'An unexpected error occurred. Please try again later.', status: 500 })
    }
    const problem = error.message
      ? { type: `https://tools.ietf.org/html/rfc9110#section-15.5`, title: error.message, status: error.status, ...(error.errors ? { errors: error.errors } : {}) }
      : ''
    throw failure(config, error.status, problem)
  }
}

/** Switches the portal to the in-browser API. Called once, before the first render. */
export function installDemo() {
  api.defaults.adapter = demoAdapter
  setHubFactory(createDemoHub)
}

export { DemoPanel } from './DemoPanel'
