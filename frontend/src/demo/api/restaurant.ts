import type { PaymentMethod, SystemHealth, TableStatus } from '@/types/api'
import { db, publish, type TableRow } from '../db'
import { RoleGroups, blank, clean, conflict, isEmail, isHttpUrl, notFound, requireRoles, requireUser, route, tooLong, validate } from '../http'
import { find, isClosed, restaurantDto, tableDto } from '../model'
import { newId, tableName } from '../util'

/** RestaurantsController, HealthController, TablesController */

const time = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const hhmm = (value: string) => value.trim().padStart(5, '0').slice(0, 5)
const methods: PaymentMethod[] = ['Cash', 'Card', 'Online', 'Test']
const statuses: TableStatus[] = ['Available', 'Occupied', 'Reserved', 'Cleaning', 'Disabled']

route('GET', '/restaurants/current', (req) => {
  requireUser(req)
  return restaurantDto()
})

/** Branding shown before login (login page, QR menu). */
route('GET', '/restaurants/public', () => {
  const r = db().restaurant
  return { name: r.name, logoUrl: r.logoUrl, coverImageUrl: r.coverImageUrl, description: r.description }
})

route('PUT', '/restaurants/:id', (req) => {
  requireRoles(req, RoleGroups.admins)
  const r = db().restaurant
  if (req.params.id !== r.id) throw notFound('Restaurant', req.params.id)
  const b = req.body ?? {}
  validate([
    ['name', blank(b.name) || tooLong(b.name, 150), "'Name' must not be empty."],
    ['logoUrl', !blank(b.logoUrl) && !isHttpUrl(b.logoUrl), 'Logo URL must be an absolute http(s) URL.'],
    ['coverImageUrl', !blank(b.coverImageUrl) && !isHttpUrl(b.coverImageUrl), 'Cover image URL must be an absolute http(s) URL.'],
    ['email', !blank(b.email) && !isEmail(b.email), "'Email' is not a valid email address."],
    ['openingTime', !time.test(String(b.openingTime ?? '')), 'Opening time must be HH:mm.'],
    ['closingTime', !time.test(String(b.closingTime ?? '')), 'Closing time must be HH:mm.'],
    ['currency', String(b.currency ?? '').trim().length !== 3, "'Currency' must be 3 characters in length."],
    ['taxRate', !(Number(b.taxRate) >= 0 && Number(b.taxRate) <= 100), "'Tax Rate' must be between 0 and 100."],
  ])
  Object.assign(r, {
    name: b.name.trim(),
    logoUrl: clean(b.logoUrl),
    coverImageUrl: clean(b.coverImageUrl),
    phone: b.phone ?? null,
    email: b.email ?? null,
    address: b.address ?? null,
    description: b.description ?? null,
    openingTime: hhmm(b.openingTime),
    closingTime: hhmm(b.closingTime),
    currency: String(b.currency).trim().toUpperCase(),
    taxRate: Number(b.taxRate),
  })
  return restaurantDto()
})

route('PUT', '/restaurants/current/settings', (req) => {
  requireRoles(req, RoleGroups.admins)
  const b = req.body ?? {}
  const enabled: PaymentMethod[] = Array.isArray(b.enabledPaymentMethods) ? b.enabledPaymentMethods.filter((m: PaymentMethod) => methods.includes(m)) : []
  validate([
    ['defaultPreparationMinutes', !(b.defaultPreparationMinutes >= 1 && b.defaultPreparationMinutes <= 240), "'Default Preparation Minutes' must be between 1 and 240."],
    ['qrMenuBaseUrl', !blank(b.qrMenuBaseUrl) && !isHttpUrl(b.qrMenuBaseUrl), 'QR base URL must be an absolute http(s) URL.'],
    ['enabledPaymentMethods', enabled.length === 0, 'Enable at least one payment method.'],
  ])
  db().restaurant.settings = {
    qrOrderingEnabled: !!b.qrOrderingEnabled,
    autoConfirmQrOrders: !!b.autoConfirmQrOrders,
    qrMenuBaseUrl: clean(b.qrMenuBaseUrl)?.replace(/\/+$/, '') ?? null,
    defaultPreparationMinutes: Math.trunc(b.defaultPreparationMinutes),
    newOrderSound: !!b.newOrderSound,
    lowStockAlerts: !!b.lowStockAlerts,
    reservationAlerts: !!b.reservationAlerts,
    enabledPaymentMethods: [...new Set(enabled)],
  }
  return restaurantDto()
})

route(
  'GET',
  '/health',
  (): SystemHealth => ({
    application: db().restaurant.name,
    status: 'Healthy',
    environment: 'Demo',
    database: {
      connected: true,
      provider: 'Browser storage (demo)',
      serverVersion: null,
      pendingMigrations: 0,
      restaurantCount: 1,
      roleCount: 7,
      error: null,
    },
    serverTimeUtc: new Date().toISOString(),
  }),
)

// ---- tables ------------------------------------------------------------------------------------

function tableInput(b: Record<string, unknown> | undefined) {
  const input = b ?? {}
  const number = Number(input.number)
  const capacity = Number(input.capacity)
  validate([
    ['number', !(Number.isInteger(number) && number >= 1 && number <= 999), "'Number' must be between 1 and 999."],
    ['capacity', !(Number.isInteger(capacity) && capacity >= 1 && capacity <= 50), "'Capacity' must be between 1 and 50."],
    ['location', tooLong(input.location, 100), "The length of 'Location' must be 100 characters or fewer."],
    ['status', !statuses.includes(input.status as TableStatus), "'Status' has a range of values which does not include the value."],
  ])
  return { number, capacity, location: clean(input.location), status: input.status as TableStatus }
}

function ensureUniqueNumber(number: number, exceptId: string | null) {
  if (db().tables.some((t) => t.number === number && t.id !== exceptId)) throw conflict(`${tableName(number)} already exists.`)
}

function tablesChanged() {
  publish('tablesChanged')
}

route('GET', '/tables', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  return [...db().tables].sort((a, b) => a.number - b.number).map(tableDto)
})

route('GET', '/tables/:id', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  return tableDto(find(db().tables, req.params.id, 'Table'))
})

route('POST', '/tables', (req) => {
  requireRoles(req, RoleGroups.management)
  const input = tableInput(req.body)
  ensureUniqueNumber(input.number, null)
  const table: TableRow = { id: newId(), ...input }
  db().tables.push(table)
  tablesChanged()
  return tableDto(table)
})

route('PUT', '/tables/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const table = find(db().tables, req.params.id, 'Table')
  const input = tableInput(req.body)
  ensureUniqueNumber(input.number, table.id)
  Object.assign(table, input)
  tablesChanged()
  return tableDto(table)
})

/** Quick status change (e.g. waiter marks a table as cleaned). */
route('PUT', '/tables/:id/status', (req) => {
  requireRoles(req, RoleGroups.tableView)
  const table = find(db().tables, req.params.id, 'Table')
  validate([['status', !statuses.includes(req.body?.status), "'Status' has a range of values which does not include the value."]])
  table.status = req.body.status
  tablesChanged()
  return tableDto(table)
})

route('DELETE', '/tables/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const table = find(d.tables, req.params.id, 'Table')
  if (d.orders.some((o) => o.tableId === table.id && !isClosed(o.status)))
    throw conflict('This table has open orders. Close them before deleting the table.')
  d.tables = d.tables.filter((t) => t !== table)
  // Order history and reservations keep their rows; the table link is cleared (ON DELETE SET NULL).
  for (const row of [...d.orders, ...d.reservations]) if (row.tableId === table.id) row.tableId = null
  tablesChanged()
})
