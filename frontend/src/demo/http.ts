import type { Role } from '@/types/api'
import { db, type UserRow } from './db'

/*
 * A tiny in-browser version of the ASP.NET Core pipeline: routing, JWT-like sessions, role checks,
 * validation and ProblemDetails errors — so the pages behave exactly as they do against the real API.
 */

export type Query = Record<string, string | string[] | undefined>

export interface DemoRequest {
  method: string
  path: string
  params: Record<string, string>
  query: Query
  /** The JSON the page sent (each handler validates it, like FluentValidation). */
  body: any
  token: string | null
}

/** A file response (report export). */
export class DemoFile {
  readonly content: Blob
  readonly fileName: string

  constructor(content: Blob, fileName: string) {
    this.content = content
    this.fileName = fileName
  }
}

/** Maps to an RFC 7807 ProblemDetails response, like GlobalExceptionHandler. */
export class HttpError extends Error {
  readonly status: number
  readonly errors?: Record<string, string[]>

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

export const notFound = (entity: string, key: unknown) => new HttpError(404, `${entity} '${key}' was not found.`)
export const conflict = (message: string) => new HttpError(409, message)
export const forbidden = (message = 'You do not have permission to perform this action.') => new HttpError(403, message)
export const unauthorized = (message: string) => new HttpError(401, message)

// ---- routing --------------------------------------------------------------------------------------

type Handler = (req: DemoRequest) => unknown

interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
}

const routes: Route[] = []

/** Registers an endpoint, e.g. route('PUT', '/orders/:id/status', handler). Paths are relative to /api. */
export function route(method: string, path: string, handler: Handler) {
  const keys: string[] = []
  const pattern = new RegExp(
    '^' +
      path.replace(/:(\w+)/g, (_, key: string) => {
        keys.push(key)
        return '([^/]+)'
      }) +
      '$',
  )
  routes.push({ method, pattern, keys, handler })
}

export function match(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue
    const m = r.pattern.exec(path)
    if (m) return { handler: r.handler, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }
  }
  return null
}

// ---- sessions & roles ------------------------------------------------------------------------------

const TOKEN_PREFIX = 'demo.'

export const tokenFor = (user: UserRow) => `${TOKEN_PREFIX}${user.id}`

/** The signed-in user, or null (anonymous endpoints). Deactivated or deleted accounts lose their session, as with the security stamp. */
export function currentUser(req: DemoRequest): UserRow | null {
  if (!req.token?.startsWith(TOKEN_PREFIX)) return null
  const id = req.token.slice(TOKEN_PREFIX.length)
  return db().users.find((u) => u.id === id && u.isActive) ?? null
}

/** [Authorize] — ASP.NET answers 401 without a body (an empty message means no ProblemDetails body). */
export function requireUser(req: DemoRequest): UserRow {
  const user = currentUser(req)
  if (!user) throw new HttpError(401, '')
  return user
}

/** [Authorize(Roles = …)] — 403 without a body. */
export function requireRoles(req: DemoRequest, roles: readonly Role[]): UserRow {
  const user = requireUser(req)
  if (!user.roles.some((r) => roles.includes(r))) throw new HttpError(403, '')
  return user
}

/** RoleGroups (FaroRestaurant.Domain/Constants/Roles.cs). */
const admins: Role[] = ['SuperAdmin', 'RestaurantAdmin']
const management: Role[] = [...admins, 'Manager']
export const RoleGroups = {
  admins,
  management,
  allStaff: [...management, 'Waiter', 'Kitchen', 'Cashier'],
  tableView: [...management, 'Waiter', 'Cashier'],
  orderCreate: [...management, 'Waiter'],
  kitchen: [...management, 'Kitchen'],
  reservations: [...management, 'Waiter'],
  customers: [...management, 'Waiter', 'Cashier'],
  payments: [...management, 'Cashier'],
} satisfies Record<string, Role[]>

// ---- validation (FluentValidation equivalents) -------------------------------------------------------

/** Collects field errors and throws a 400 ValidationProblemDetails when any rule failed. */
export function validate(rules: [field: string, failed: boolean, message: string][]) {
  const errors: Record<string, string[]> = {}
  for (const [field, failed, message] of rules) if (failed) (errors[field] ??= []).push(message)
  if (Object.keys(errors).length) throw new HttpError(400, 'One or more validation errors occurred.', errors)
}

export const blank = (value: unknown) => typeof value !== 'string' || value.trim() === ''
export const tooLong = (value: unknown, max: number) => typeof value === 'string' && value.length > max
export const isEmail = (value: string) => /^[^@\s]+@[^@\s]+$/.test(value)
export const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value.trim()).protocol)
  } catch {
    return false
  }
}

/** PasswordRules.StrongPassword — returns the first broken rule. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password === '') return "'Password' must not be empty."
  if (password.length < 8) return 'The length of \'Password\' must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain a digit.'
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain a symbol.'
  return null
}

/** Trims a text field; empty becomes null. */
export const clean = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)

// ---- query helpers ------------------------------------------------------------------------------------

export const one = (q: Query, key: string) => {
  const v = q[key]
  return (Array.isArray(v) ? v[0] : v) || undefined
}

export const many = (q: Query, key: string) => {
  const v = q[key]
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

export const int = (q: Query, key: string, fallback: number) => {
  const v = Number(one(q, key))
  return Number.isFinite(v) ? Math.trunc(v) : fallback
}

/** PagingExtensions.ToPagedAsync */
export function paged<T>(items: T[], page: number, pageSize: number) {
  page = Math.max(1, page)
  pageSize = Math.min(Math.max(1, pageSize), 100)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalCount: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  }
}
