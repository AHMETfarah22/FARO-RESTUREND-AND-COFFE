import type { InventoryTransactionType, ReservationStatus, Role } from '@/types/api'
import { toIsoDate } from '@/lib/format'
import { db, publish, type CustomerRow, type InventoryRow, type ReservationRow, type StaffRow, type UserRow } from '../db'
import {
  HttpError,
  RoleGroups,
  blank,
  clean,
  conflict,
  int,
  isEmail,
  one,
  paged,
  passwordProblem,
  requireRoles,
  route,
  tooLong,
  validate,
} from '../http'
import { byNewest, customerDto, find, inventoryDto, notificationDto, notify, orderDto, reservationDto, staffDto } from '../model'
import { newId, shortMonth, tableName } from '../util'

/** ReservationsController, CustomersController, StaffController, InventoryController, NotificationsController */

const now = () => new Date().toISOString()
const phonePattern = /^[0-9 +()-]*$/
const time = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const reservationStatuses: ReservationStatus[] = ['Pending', 'Confirmed', 'Arrived', 'Completed', 'Cancelled']

// ---- reservations ------------------------------------------------------------------------------------

/** "19:30" → "19:30:00" (TimeOnly) */
const toTime = (value: string) => {
  const [h, m] = value.split(':')
  return `${h.padStart(2, '0')}:${m}:00`
}
const minutesOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))

function applyReservation(r: ReservationRow, body: Record<string, unknown> | undefined) {
  const b = body ?? {}
  const partySize = Number(b.partySize)
  validate([
    ['customerName', blank(b.customerName) || tooLong(b.customerName, 150), "'Customer Name' must not be empty."],
    ['phone', blank(b.phone) || tooLong(b.phone, 30) || !phonePattern.test(String(b.phone)), 'Phone number contains invalid characters.'],
    ['email', !blank(b.email) && !isEmail(String(b.email)), "'Email' is not a valid email address."],
    ['date', !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date ?? '')), "'Date' must not be empty."],
    ['time', !time.test(String(b.time ?? '')), 'Time must be HH:mm.'],
    ['partySize', !(Number.isInteger(partySize) && partySize >= 1 && partySize <= 50), "'Party Size' must be between 1 and 50."],
    ['status', !reservationStatuses.includes(b.status as ReservationStatus), "'Status' has a range of values which does not include the value."],
    ['notes', tooLong(b.notes, 500), "The length of 'Notes' must be 500 characters or fewer."],
  ])
  const d = db()
  const at = toTime(String(b.time))
  const tableId = (b.tableId as string | null) || null

  if (tableId) {
    const table = find(d.tables, tableId, 'Table')
    if (table.capacity < partySize) throw conflict(`${tableName(table.number)} seats ${table.capacity}; the party has ${partySize} people.`)
    // A table is considered booked for 2 hours either side (same day).
    const clash = d.reservations.some(
      (x) =>
        x.id !== r.id &&
        x.tableId === tableId &&
        x.date === b.date &&
        x.status !== 'Cancelled' &&
        x.status !== 'Completed' &&
        Math.abs(minutesOf(x.time) - minutesOf(at)) < 120,
    )
    if (clash) throw conflict(`${tableName(table.number)} already has a reservation within 2 hours of ${String(b.time)}.`)
  }

  // Link to (or create) the customer record by phone so the customer history stays complete.
  const phone = String(b.phone).trim()
  let customer = d.customers.find((c) => c.phone === phone)
  if (!customer) {
    customer = { id: newId(), name: String(b.customerName).trim(), phone, email: clean(b.email), notes: null, userId: null, createdAt: now() }
    d.customers.push(customer)
  }

  Object.assign(r, {
    customerId: customer.id,
    customerName: String(b.customerName).trim(),
    phone,
    email: clean(b.email),
    date: String(b.date),
    time: at,
    partySize,
    tableId,
    status: b.status as ReservationStatus,
    notes: (b.notes as string | null) ?? null,
  })
}

route('GET', '/reservations', (req) => {
  requireRoles(req, RoleGroups.reservations)
  const from = one(req.query, 'from')
  const to = one(req.query, 'to')
  const status = one(req.query, 'status')
  const term = one(req.query, 'search')?.trim().toLowerCase()
  return db()
    .reservations.filter((r) => (!from || r.date >= from) && (!to || r.date <= to) && (!status || r.status === status))
    .filter((r) => !term || r.customerName.toLowerCase().includes(term) || r.phone.toLowerCase().includes(term))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 500)
    .map(reservationDto)
})

route('GET', '/reservations/:id', (req) => {
  requireRoles(req, RoleGroups.reservations)
  return reservationDto(find(db().reservations, req.params.id, 'Reservation'))
})

route('POST', '/reservations', (req) => {
  requireRoles(req, RoleGroups.reservations)
  const r = { id: newId(), createdAt: now() } as ReservationRow
  applyReservation(r, req.body)
  db().reservations.push(r)
  const [y, m, day] = r.date.split('-').map(Number)
  notify(
    'Reservation',
    `New reservation · ${r.customerName}`,
    `${String(day).padStart(2, '0')} ${shortMonth(new Date(y, m - 1, day))} at ${r.time.slice(0, 5)} · ${r.partySize} people`,
    '/reservations',
  )
  return reservationDto(r)
})

route('PUT', '/reservations/:id', (req) => {
  requireRoles(req, RoleGroups.reservations)
  const r = find(db().reservations, req.params.id, 'Reservation')
  applyReservation(r, req.body)
  return reservationDto(r)
})

route('PUT', '/reservations/:id/status', (req) => {
  requireRoles(req, RoleGroups.reservations)
  const r = find(db().reservations, req.params.id, 'Reservation')
  validate([['status', !reservationStatuses.includes(req.body?.status), "'Status' has a range of values which does not include the value."]])
  r.status = req.body.status
  // Seat the guests: an arrived reservation occupies its table.
  if (r.status === 'Arrived' && r.tableId) {
    const table = db().tables.find((t) => t.id === r.tableId)
    if (table && (table.status === 'Available' || table.status === 'Reserved')) {
      table.status = 'Occupied'
      publish('tablesChanged')
    }
  }
  return reservationDto(r)
})

route('DELETE', '/reservations/:id', (req) => {
  requireRoles(req, RoleGroups.reservations)
  const d = db()
  const r = find(d.reservations, req.params.id, 'Reservation')
  d.reservations = d.reservations.filter((x) => x !== r)
})

// ---- customers ------------------------------------------------------------------------------------------

function customerInput(b: Record<string, unknown> | undefined, exceptId: string | null) {
  const input = b ?? {}
  validate([
    ['name', blank(input.name) || tooLong(input.name, 150), "'Name' must not be empty."],
    ['phone', tooLong(input.phone, 30) || !phonePattern.test(String(input.phone ?? '')), 'Phone number contains invalid characters.'],
    ['email', !blank(input.email) && !isEmail(String(input.email)), "'Email' is not a valid email address."],
    ['notes', tooLong(input.notes, 500), "The length of 'Notes' must be 500 characters or fewer."],
  ])
  const phone = clean(input.phone)
  if (phone && db().customers.some((c) => c.phone === phone && c.id !== exceptId)) throw conflict('A customer with this phone number already exists.')
  return { name: String(input.name).trim(), phone, email: clean(input.email)?.toLowerCase() ?? null, notes: (input.notes as string | null) ?? null }
}

route('GET', '/customers', (req) => {
  requireRoles(req, RoleGroups.customers)
  const term = one(req.query, 'search')?.trim().toLowerCase()
  const rows = db()
    .customers.filter((c) => !term || [c.name, c.phone ?? '', c.email ?? ''].some((v) => v.toLowerCase().includes(term)))
    .map(customerDto)
    .sort((a, b) => b.totalSpending - a.totalSpending || a.name.localeCompare(b.name))
  return paged(rows, int(req.query, 'page', 1), int(req.query, 'pageSize', 20))
})

route('GET', '/customers/:id', (req) => {
  requireRoles(req, RoleGroups.customers)
  const d = db()
  const customer = find(d.customers, req.params.id, 'Customer')
  return {
    customer: customerDto(customer),
    orders: d.orders.filter((o) => o.customerId === customer.id).sort(byNewest).slice(0, 50).map(orderDto),
    reservations: d.reservations
      .filter((r) => r.customerId === customer.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .slice(0, 50)
      .map(reservationDto),
  }
})

route('POST', '/customers', (req) => {
  requireRoles(req, RoleGroups.customers)
  const customer: CustomerRow = { id: newId(), ...customerInput(req.body, null), userId: null, createdAt: now() }
  db().customers.push(customer)
  return customerDto(customer)
})

route('PUT', '/customers/:id', (req) => {
  requireRoles(req, RoleGroups.customers)
  const customer = find(db().customers, req.params.id, 'Customer')
  Object.assign(customer, customerInput(req.body, customer.id))
  return customerDto(customer)
})

route('DELETE', '/customers/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const customer = find(d.customers, req.params.id, 'Customer')
  d.customers = d.customers.filter((c) => c !== customer)
  // Orders and reservations keep the name snapshot; the link is cleared.
  for (const row of [...d.orders, ...d.reservations]) if (row.customerId === customer.id) row.customerId = null
})

// ---- staff ------------------------------------------------------------------------------------------------

const staffRoles: Role[] = ['Manager', 'Waiter', 'Kitchen', 'Cashier']

function staffInput(b: Record<string, unknown> | undefined, withPassword: boolean) {
  const input = b ?? {}
  const passwordError = withPassword ? passwordProblem(input.password) : null
  validate([
    ['fullName', blank(input.fullName) || tooLong(input.fullName, 150), "'Full Name' must not be empty."],
    ['email', blank(input.email) || !isEmail(String(input.email).trim()), "'Email' is not a valid email address."],
    ['userName', blank(input.userName) || !/^[a-zA-Z0-9._@-]+$/.test(String(input.userName).trim()), 'Username may contain letters, digits and . _ @ - only.'],
    ['phone', tooLong(input.phone, 30), "The length of 'Phone' must be 30 characters or fewer."],
    ['password', !!passwordError, passwordError ?? ''],
  ])
  if (!staffRoles.includes(input.role as Role)) throw new HttpError(400, 'One or more validation errors occurred.', { role: [`Role must be one of: ${staffRoles.join(', ')}.`] })
  return {
    fullName: String(input.fullName).trim(),
    email: String(input.email).trim().toLowerCase(),
    userName: String(input.userName).trim(),
    phone: (input.phone as string | null) || null,
    role: input.role as Role,
    isActive: !!input.isActive,
  }
}

/** IdentityService: e-mail and username are unique across all accounts. */
function ensureUniqueAccount(email: string, userName: string, exceptUserId: string | null) {
  const users = db().users.filter((u) => u.id !== exceptUserId)
  if (users.some((u) => u.email.toLowerCase() === email)) throw conflict('An account with this email already exists.')
  if (users.some((u) => u.userName.toLowerCase() === userName.toLowerCase())) throw conflict('This username is already taken.')
}

route('GET', '/staff', (req) => {
  requireRoles(req, RoleGroups.management)
  return [...db().staff].sort((a, b) => a.role.localeCompare(b.role) || a.fullName.localeCompare(b.fullName)).map(staffDto)
})

route('POST', '/staff', (req) => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const input = staffInput(req.body, true)
  ensureUniqueAccount(input.email, input.userName, null)
  const user: UserRow = {
    id: newId(),
    fullName: input.fullName,
    email: input.email,
    userName: input.userName,
    phone: input.phone,
    roles: [input.role],
    restaurantId: d.restaurant.id,
    password: req.body.password,
    isActive: input.isActive,
  }
  const member: StaffRow = { id: newId(), userId: user.id, fullName: input.fullName, email: input.email, phone: input.phone, role: input.role, isActive: input.isActive, hiredOn: toIsoDate(new Date()), createdAt: now() }
  d.users.push(user)
  d.staff.push(member)
  return staffDto(member)
})

route('PUT', '/staff/:id', (req) => {
  const me = requireRoles(req, RoleGroups.management)
  const d = db()
  const member = find(d.staff, req.params.id, 'Staff member')
  const input = staffInput(req.body, false)
  if (member.userId === me.id && !input.isActive) throw conflict('You cannot deactivate your own account.')
  ensureUniqueAccount(input.email, input.userName, member.userId)

  const user = find(d.users, member.userId, 'User')
  Object.assign(user, { fullName: input.fullName, email: input.email, userName: input.userName, phone: input.phone, roles: [input.role], isActive: input.isActive })
  Object.assign(member, { fullName: input.fullName, email: input.email, phone: input.phone, role: input.role, isActive: input.isActive })
  return staffDto(member)
})

route('POST', '/staff/:id/reset-password', (req) => {
  requireRoles(req, RoleGroups.management)
  const member = find(db().staff, req.params.id, 'Staff member')
  const passwordError = passwordProblem(req.body?.newPassword)
  validate([['newPassword', !!passwordError, passwordError ?? '']])
  find(db().users, member.userId, 'User').password = req.body.newPassword
})

route('DELETE', '/staff/:id', (req) => {
  const me = requireRoles(req, RoleGroups.management)
  const d = db()
  const member = find(d.staff, req.params.id, 'Staff member')
  if (member.userId === me.id) throw conflict('You cannot delete your own account.')
  d.staff = d.staff.filter((s) => s !== member)
  d.users = d.users.filter((u) => u.id !== member.userId)
})

// ---- inventory ----------------------------------------------------------------------------------------------

const movementTypes: InventoryTransactionType[] = ['StockIn', 'StockOut', 'Adjustment']

/** Quantities are shown like .NET's "0.##". */
const qty = (value: number) => String(Math.round(value * 100) / 100)

function inventoryInput(b: Record<string, unknown> | undefined) {
  const input = b ?? {}
  const n = (key: string) => Number(input[key])
  const selling = input.sellingPrice === null || input.sellingPrice === undefined || input.sellingPrice === '' ? null : n('sellingPrice')
  validate([
    ['name', blank(input.name) || tooLong(input.name, 120), "'Name' must not be empty."],
    ['unit', blank(input.unit) || tooLong(input.unit, 20), "'Unit' must not be empty."],
    ['quantity', !(n('quantity') >= 0), "'Quantity' must be greater than or equal to '0'."],
    ['minimumQuantity', !(n('minimumQuantity') >= 0), "'Minimum Quantity' must be greater than or equal to '0'."],
    ['supplier', tooLong(input.supplier, 150), "The length of 'Supplier' must be 150 characters or fewer."],
    ['purchasePrice', !(n('purchasePrice') >= 0), "'Purchase Price' must be greater than or equal to '0'."],
    ['sellingPrice', selling !== null && !(selling >= 0), "'Selling Price' must be greater than or equal to '0'."],
  ])
  return {
    name: String(input.name).trim(),
    unit: String(input.unit).trim(),
    quantity: n('quantity'),
    minimumQuantity: n('minimumQuantity'),
    supplier: clean(input.supplier),
    purchasePrice: n('purchasePrice'),
    sellingPrice: selling,
  }
}

function record(item: InventoryRow, type: InventoryTransactionType, change: number, note: string | null) {
  item.quantity = Math.round((item.quantity + change) * 1000) / 1000
  item.updatedAt = now()
  db().inventoryTransactions.push({ id: newId(), itemId: item.id, type, quantityChange: change, quantityAfter: item.quantity, note, createdAt: item.updatedAt })
}

/** Raises a LOW STOCK notification when an item crosses its minimum. */
function alertIfLow(item: InventoryRow, wasLow: boolean) {
  if (wasLow || item.quantity > item.minimumQuantity || !db().restaurant.settings.lowStockAlerts) return
  notify('LowStock', `Low stock · ${item.name}`, `Remaining: ${qty(item.quantity)} ${item.unit} · Minimum: ${qty(item.minimumQuantity)} ${item.unit}`, '/inventory')
}

route('GET', '/inventory', (req) => {
  requireRoles(req, RoleGroups.management)
  const term = one(req.query, 'search')?.trim().toLowerCase()
  const lowOnly = one(req.query, 'lowStock') === 'true'
  return db()
    .inventory.filter((i) => !term || i.name.toLowerCase().includes(term) || (i.supplier ?? '').toLowerCase().includes(term))
    .filter((i) => !lowOnly || i.quantity <= i.minimumQuantity)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(inventoryDto)
})

route('POST', '/inventory', (req) => {
  requireRoles(req, RoleGroups.management)
  const input = inventoryInput(req.body)
  const item: InventoryRow = { id: newId(), ...input, quantity: 0, createdAt: now(), updatedAt: null }
  db().inventory.push(item)
  record(item, 'StockIn', input.quantity, 'Opening stock')
  item.updatedAt = null
  alertIfLow(item, false)
  return inventoryDto(item)
})

route('PUT', '/inventory/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const item = find(db().inventory, req.params.id, 'Inventory item')
  const wasLow = item.quantity <= item.minimumQuantity
  const { quantity, ...fields } = inventoryInput(req.body)
  Object.assign(item, fields, { updatedAt: now() })
  // Editing the quantity directly is recorded as an adjustment so the history stays accurate.
  if (quantity !== item.quantity) record(item, 'Adjustment', quantity - item.quantity, 'Edited quantity')
  alertIfLow(item, wasLow)
  return inventoryDto(item)
})

route('DELETE', '/inventory/:id', (req) => {
  requireRoles(req, RoleGroups.management)
  const d = db()
  const item = find(d.inventory, req.params.id, 'Inventory item')
  d.inventory = d.inventory.filter((i) => i !== item)
  d.inventoryTransactions = d.inventoryTransactions.filter((t) => t.itemId !== item.id)
})

/** StockIn/StockOut take a positive amount; Adjustment sets the counted quantity. */
route('POST', '/inventory/:id/movements', (req) => {
  requireRoles(req, RoleGroups.management)
  const item = find(db().inventory, req.params.id, 'Inventory item')
  const type = req.body?.type as InventoryTransactionType
  const quantity = Number(req.body?.quantity)
  validate([
    ['type', !movementTypes.includes(type), "'Type' has a range of values which does not include the value."],
    ['quantity', type === 'Adjustment' ? !(quantity >= 0) : !(quantity > 0), "'Quantity' must be greater than '0'."],
    ['note', tooLong(req.body?.note, 200), "The length of 'Note' must be 200 characters or fewer."],
  ])
  const wasLow = item.quantity <= item.minimumQuantity
  const change = type === 'StockIn' ? quantity : type === 'StockOut' ? -quantity : quantity - item.quantity
  if (item.quantity + change < 0) throw conflict(`Only ${qty(item.quantity)} ${item.unit} of ${item.name} in stock.`)
  record(item, type, change, (req.body?.note as string | null) ?? null)
  alertIfLow(item, wasLow)
  return inventoryDto(item)
})

route('GET', '/inventory/:id/transactions', (req) => {
  requireRoles(req, RoleGroups.management)
  const item = find(db().inventory, req.params.id, 'Inventory item')
  return db()
    .inventoryTransactions.filter((t) => t.itemId === item.id)
    .sort(byNewest)
    .slice(0, 100)
    .map((t) => ({ id: t.id, type: t.type, quantityChange: t.quantityChange, quantityAfter: t.quantityAfter, note: t.note, createdAt: t.createdAt }))
})

// ---- notifications ------------------------------------------------------------------------------------------

route('GET', '/notifications', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  const all = db().notifications
  const unreadOnly = one(req.query, 'unreadOnly') === 'true'
  const take = Math.min(Math.max(int(req.query, 'take', 50), 1), 200)
  return {
    items: all.filter((n) => !unreadOnly || !n.isRead).sort(byNewest).slice(0, take).map(notificationDto),
    unreadCount: all.filter((n) => !n.isRead).length,
  }
})

route('PUT', '/notifications/:id/read', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  find(db().notifications, req.params.id, 'Notification').isRead = true
})

route('PUT', '/notifications/read-all', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  for (const n of db().notifications) n.isRead = true
})

route('DELETE', '/notifications/:id', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  const d = db()
  const n = find(d.notifications, req.params.id, 'Notification')
  d.notifications = d.notifications.filter((x) => x !== n)
})
