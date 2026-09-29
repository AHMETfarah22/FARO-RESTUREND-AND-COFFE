import type { OrderItemInput, OrderStatus, PaymentMethod, PaymentStatus, Role } from '@/types/api'
import { db, publish, type OrderRow, type PaymentRow, type UserRow } from '../db'
import { RoleGroups, blank, clean, conflict, forbidden, int, many, notFound, one, paged, requireRoles, route, tooLong, validate, type Query } from '../http'
import { byNewest, find, notify, orderDto, paymentDto, publicOrderDto } from '../model'
import { localDate, newId, recalculate, round2, sum, tableName } from '../util'

/** OrdersController, KitchenController, PublicMenuController (orders), PaymentsController — OrderService & PaymentService. */

const OPEN: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served']
const ALL_STATUSES: OrderStatus[] = [...OPEN, 'Completed', 'Cancelled']
const METHODS: PaymentMethod[] = ['Cash', 'Card', 'Online', 'Test']

/** Allowed status workflow. Anything not listed is rejected. */
const transitions: Record<OrderStatus, OrderStatus[]> = {
  Pending: ['Confirmed', 'Preparing', 'Cancelled'],
  Confirmed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['Served', 'Completed'],
  Served: ['Completed'],
  Completed: [],
  Cancelled: [],
}

/** OrderDuties: the kitchen cooks, the waiter serves, the cashier closes. Management may do every step. */
const duties: Partial<Record<OrderStatus, Role[]>> = {
  Confirmed: ['Waiter', 'Kitchen'],
  Preparing: ['Kitchen'],
  Ready: ['Kitchen'],
  Served: ['Waiter'],
  Completed: ['Cashier'],
  Cancelled: ['Waiter'],
}

const now = () => new Date().toISOString()

// ---- helpers (OrderService) ---------------------------------------------------------------------------

function validateItems(items: unknown, emptyMessage: string, max: number) {
  const list = Array.isArray(items) ? (items as OrderItemInput[]) : []
  validate([
    ['items', list.length === 0, emptyMessage],
    ['items.Count', list.length > max, `'Items Count' must be less than or equal to '${max}'.`],
    ['items', list.some((i) => blank(i?.productId)), "'Product Id' must not be empty."],
    ['items', list.some((i) => !(Number.isInteger(i?.quantity) && i.quantity >= 1 && i.quantity <= 99)), "'Quantity' must be between 1 and 99."],
    ['items', list.some((i) => tooLong(i?.notes, 200)), "The length of 'Notes' must be 200 characters or fewer."],
  ])
  return list
}

function applyTableAndCustomer(order: OrderRow, tableId: string | null | undefined, customerId: string | null | undefined, customerName: unknown) {
  const d = db()
  if (tableId) {
    const table = find(d.tables, tableId, 'Table')
    if (table.status === 'Disabled') throw conflict(`${tableName(table.number)} is disabled.`)
    order.tableId = table.id
  } else order.tableId = null

  if (customerId) {
    const customer = find(d.customers, customerId, 'Customer')
    order.customerId = customer.id
    order.customerName = customer.name
  } else {
    order.customerId = null
    order.customerName = clean(customerName)
  }
}

/** Adds line items at current menu prices and reserves tracked stock. */
function addItems(order: OrderRow, items: OrderItemInput[]) {
  const d = db()
  const requested = new Map<string, number>()
  for (const i of items) requested.set(i.productId, (requested.get(i.productId) ?? 0) + i.quantity)

  for (const [productId, quantity] of requested) {
    const product = d.products.find((p) => p.id === productId)
    if (!product) throw notFound('Product', productId)
    if (!product.isAvailable) throw conflict(`${product.name} is currently unavailable.`)
    if (product.stock !== null) {
      if (product.stock < quantity) throw conflict(product.stock === 0 ? `${product.name} is out of stock.` : `Only ${product.stock} × ${product.name} left.`)
      product.stock -= quantity
    }
  }

  for (const i of items) {
    const product = d.products.find((p) => p.id === i.productId)!
    order.items.push({ id: newId(), productId: product.id, productName: product.name, unitPrice: product.price, quantity: i.quantity, notes: clean(i.notes) })
  }
}

function restoreStock(order: OrderRow) {
  for (const product of db().products) {
    if (product.stock === null) continue
    const quantity = sum(order.items.filter((i) => i.productId === product.id).map((i) => i.quantity))
    product.stock += quantity
  }
}

function occupyTable(tableId: string | null) {
  const table = tableId ? db().tables.find((t) => t.id === tableId) : undefined
  if (table && ['Available', 'Reserved', 'Cleaning'].includes(table.status)) table.status = 'Occupied'
}

/** The masa becomes Available as soon as nothing is left to pay on it (no other open, unpaid order). */
function releaseTable(tableId: string | null, settledOrderId: string) {
  if (!tableId) return false
  const d = db()
  if (d.orders.some((o) => o.tableId === tableId && o.id !== settledOrderId && OPEN.includes(o.status) && o.paymentStatus !== 'Paid')) return false
  const table = d.tables.find((t) => t.id === tableId)
  if (!table || table.status !== 'Occupied') return false
  table.status = 'Available'
  return true
}

function publishCreated(order: OrderRow) {
  const dto = orderDto(order)
  publish('orderCreated', dto)
  publish('orderStatus', { id: dto.id, status: dto.status })
  if (order.tableId) publish('tablesChanged')
  notify(
    'NewOrder',
    `New order #${dto.number} · ${dto.tableName ?? 'Takeaway'}`,
    dto.items.map((i) => `${i.quantity}x ${i.productName}`).join(', '),
    `/orders/${dto.id}`,
  )
  return dto
}

function publishUpdated(order: OrderRow) {
  const dto = orderDto(order)
  publish('orderUpdated', dto)
  publish('orderStatus', { id: dto.id, status: dto.status })
  if (order.tableId) publish('tablesChanged')
  return dto
}

function newOrder(fields: Partial<OrderRow>): OrderRow {
  const d = db()
  return {
    id: newId(),
    number: d.nextOrderNumber++,
    tableId: null,
    customerId: null,
    customerName: null,
    source: 'Staff',
    status: 'Pending',
    paymentStatus: 'Pending',
    subtotal: 0,
    discount: 0,
    taxRate: d.restaurant.taxRate,
    taxAmount: 0,
    total: 0,
    notes: null,
    createdAt: now(),
    updatedAt: null,
    completedAt: null,
    items: [],
    payments: [],
    ...fields,
  }
}

function changeStatus(order: OrderRow, status: OrderStatus, user: UserRow) {
  if (order.status === status) return orderDto(order)
  if (!transitions[order.status].includes(status)) throw conflict(`An order cannot move from ${order.status} to ${status}.`)

  const management = user.roles.some((r) => RoleGroups.management.includes(r))
  if (!management && !user.roles.some((r) => duties[status]?.includes(r))) throw forbidden(`Your role cannot mark orders as ${status}.`)
  if (status === 'Completed' && order.paymentStatus !== 'Paid') throw conflict('Take payment before completing the order.')

  order.status = status
  order.updatedAt = now()
  if (status === 'Cancelled') {
    restoreStock(order)
    releaseTable(order.tableId, order.id)
  } else if (status === 'Completed') {
    order.completedAt = order.updatedAt
    releaseTable(order.tableId, order.id)
  }
  return publishUpdated(order)
}

function orderInput(body: Record<string, unknown> | undefined) {
  const b = body ?? {}
  const items = validateItems(b.items, 'Add at least one product.', 50)
  const discount = Number(b.discount ?? 0)
  validate([
    ['customerName', tooLong(b.customerName, 150), "The length of 'Customer Name' must be 150 characters or fewer."],
    ['notes', tooLong(b.notes, 500), "The length of 'Notes' must be 500 characters or fewer."],
    ['discount', !(discount >= 0), "'Discount' must be greater than or equal to '0'."],
  ])
  return { items, discount, notes: (b.notes as string | null) ?? null, tableId: b.tableId as string | null, customerId: b.customerId as string | null, customerName: b.customerName }
}

/** Local-date range filter (from/to are the restaurant's calendar days). */
const inRange = (iso: string, q: Query) => {
  const day = localDate(iso)
  const from = one(q, 'from')
  const to = one(q, 'to')
  return (!from || day >= from) && (!to || day <= to)
}

// ---- staff order endpoints --------------------------------------------------------------------------

route('GET', '/orders', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  const d = db()
  const statuses = many(req.query, 'status') as OrderStatus[]
  const paymentStatus = one(req.query, 'paymentStatus') as PaymentStatus | undefined
  const tableId = one(req.query, 'tableId')
  const search = one(req.query, 'search')?.trim().replace(/^#+/, '')
  const number = search && /^\d+$/.test(search) ? Number(search) : null
  const term = search?.toLowerCase()

  const rows = d.orders
    .filter((o) => statuses.length === 0 || statuses.includes(o.status))
    .filter((o) => !paymentStatus || o.paymentStatus === paymentStatus)
    .filter((o) => !tableId || o.tableId === tableId)
    .filter((o) => inRange(o.createdAt, req.query))
    .filter((o) => {
      if (!term) return true
      if (number !== null) return o.number === number || d.tables.find((t) => t.id === o.tableId)?.number === number
      const customer = o.customerId ? d.customers.find((c) => c.id === o.customerId) : undefined
      return (o.customerName ?? '').toLowerCase().includes(term) || (customer?.name ?? '').toLowerCase().includes(term)
    })
    .sort(byNewest)

  const page = paged(rows, int(req.query, 'page', 1), int(req.query, 'pageSize', 20))
  return { ...page, items: page.items.map(orderDto) }
})

route('GET', '/orders/:id', (req) => {
  requireRoles(req, RoleGroups.allStaff)
  return orderDto(find(db().orders, req.params.id, 'Order'))
})

route('POST', '/orders', (req) => {
  requireRoles(req, RoleGroups.orderCreate)
  const input = orderInput(req.body)
  // Staff orders are confirmed on entry.
  const order = newOrder({ source: 'Staff', status: 'Confirmed', discount: input.discount, notes: input.notes })
  applyTableAndCustomer(order, input.tableId, input.customerId, input.customerName)
  addItems(order, input.items)
  recalculate(order)
  db().orders.push(order)
  occupyTable(order.tableId)
  return publishCreated(order)
})

route('PUT', '/orders/:id', (req) => {
  requireRoles(req, RoleGroups.orderCreate)
  const order = find(db().orders, req.params.id, 'Order')
  const input = orderInput(req.body)
  if (order.status !== 'Pending' && order.status !== 'Confirmed')
    throw conflict('Items can only be changed before the kitchen starts preparing the order.')

  const previousTable = order.tableId
  applyTableAndCustomer(order, input.tableId, input.customerId, input.customerName)
  order.notes = input.notes
  order.discount = input.discount
  restoreStock(order)
  order.items = []
  addItems(order, input.items)
  recalculate(order)
  order.updatedAt = now()
  if (previousTable !== order.tableId) {
    occupyTable(order.tableId)
    releaseTable(previousTable, order.id)
    if (previousTable) publish('tablesChanged')
  }
  return publishUpdated(order)
})

route('PUT', '/orders/:id/status', (req) => {
  const user = requireRoles(req, RoleGroups.allStaff)
  const order = find(db().orders, req.params.id, 'Order')
  validate([['status', !ALL_STATUSES.includes(req.body?.status), "'Status' has a range of values which does not include the value."]])
  return changeStatus(order, req.body.status, user)
})

/** Active tickets for the kitchen display plus recently finished ones. */
route('GET', '/kitchen/orders', (req) => {
  requireRoles(req, RoleGroups.kitchen)
  const recentSince = new Date(Date.now() - 3 * 60 * 60_000).toISOString()
  const active: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready']
  return db()
    .orders.filter((o) => active.includes(o.status) || ((o.status === 'Served' || o.status === 'Completed') && (o.updatedAt ?? o.createdAt) >= recentSince))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 200)
    .map(orderDto)
})

// ---- public QR menu orders (no login) -------------------------------------------------------------------

route('POST', '/menu/tables/:tableId/orders', (req) => {
  const d = db()
  const b = req.body ?? {}
  const items = validateItems(b.items, 'Your cart is empty.', 30)
  validate([
    ['customerName', tooLong(b.customerName, 100), "The length of 'Customer Name' must be 100 characters or fewer."],
    ['phone', tooLong(b.phone, 30) || !/^[0-9 +()-]*$/.test(String(b.phone ?? '')), 'Phone number contains invalid characters.'],
    ['notes', tooLong(b.notes, 300), "The length of 'Notes' must be 300 characters or fewer."],
  ])

  const table = find(d.tables, req.params.tableId, 'Table')
  if (!d.restaurant.isActive || !d.restaurant.settings.qrOrderingEnabled) throw conflict('Online ordering is currently unavailable. Please ask a waiter.')
  if (table.status === 'Disabled') throw conflict('This table is not accepting orders. Please ask a waiter.')

  const order = newOrder({
    tableId: table.id,
    source: 'QrMenu',
    status: d.restaurant.settings.autoConfirmQrOrders ? 'Confirmed' : 'Pending',
    notes: (b.notes as string | null) ?? null,
    customerName: clean(b.customerName),
  })

  const phone = clean(b.phone)
  if (phone) {
    let customer = d.customers.find((c) => c.phone === phone)
    if (!customer) {
      customer = { id: newId(), name: order.customerName ?? 'Guest', phone, email: null, notes: null, userId: null, createdAt: now() }
      d.customers.push(customer)
    }
    order.customerId = customer.id
    order.customerName ??= customer.name
  }

  addItems(order, items)
  recalculate(order)
  d.orders.push(order)
  occupyTable(order.tableId)
  publishCreated(order)
  return publicOrderDto(order)
})

route('GET', '/menu/orders/:orderId', (req) => publicOrderDto(find(db().orders, req.params.orderId, 'Order')))

// ---- payments (PaymentService) -------------------------------------------------------------------------

const allPayments = () => db().orders.flatMap((o) => o.payments.map((p) => ({ order: o, payment: p })))

route('GET', '/payments', (req) => {
  requireRoles(req, RoleGroups.payments)
  const status = one(req.query, 'status')
  const method = one(req.query, 'method')
  const rows = allPayments()
    .filter(({ payment }) => inRange(payment.createdAt, req.query))
    .filter(({ payment }) => !status || payment.status === status)
    .filter(({ payment }) => !method || payment.method === method)
    .sort((a, b) => b.payment.createdAt.localeCompare(a.payment.createdAt))
  const page = paged(rows, int(req.query, 'page', 1), int(req.query, 'pageSize', 20))
  return { ...page, items: page.items.map(({ order, payment }) => paymentDto(order, payment)) }
})

route('GET', '/payments/summary', (req) => {
  requireRoles(req, RoleGroups.payments)
  const rows = allPayments().filter(({ payment }) => inRange(payment.createdAt, req.query)).map((r) => r.payment)
  const paid = rows.filter((p) => p.status === 'Paid')
  return {
    paidTotal: round2(sum(paid.map((p) => p.amount))),
    refundedTotal: round2(sum(rows.filter((p) => p.status === 'Refunded').map((p) => p.amount))),
    paidCount: paid.length,
    failedCount: rows.filter((p) => p.status === 'Failed').length,
    byMethod: Object.fromEntries(METHODS.map((m) => [m, round2(sum(paid.filter((p) => p.method === m).map((p) => p.amount)))])),
  }
})

/** Amount defaults to the outstanding balance. simulateFailure exercises the declined-card path (SimulatedPaymentGateway). */
route('POST', '/payments', (req) => {
  const user = requireRoles(req, RoleGroups.payments)
  const d = db()
  const b = req.body ?? {}
  validate([
    ['orderId', blank(b.orderId), "'Order Id' must not be empty."],
    ['method', !METHODS.includes(b.method), "'Method' has a range of values which does not include the value."],
    ['amount', b.amount !== null && b.amount !== undefined && !(Number(b.amount) > 0), "'Amount' must be greater than '0'."],
  ])
  const order = find(d.orders, b.orderId, 'Order')
  const method = b.method as PaymentMethod

  if (order.status === 'Cancelled') throw conflict('A cancelled order cannot be paid.')
  if (!d.restaurant.settings.enabledPaymentMethods.includes(method)) throw conflict(`${method} payments are disabled in settings.`)

  const paidSoFar = round2(sum(order.payments.filter((p) => p.status === 'Paid').map((p) => p.amount)))
  const outstanding = round2(order.total - paidSoFar)
  if (outstanding <= 0) throw conflict('This order is already fully paid.')
  const amount = b.amount === null || b.amount === undefined ? outstanding : round2(Number(b.amount))
  if (amount > outstanding) throw conflict(`Amount exceeds the outstanding balance (${outstanding.toFixed(2)}).`)

  const success = !b.simulateFailure
  const at = now()
  const payment: PaymentRow = {
    id: newId(),
    amount,
    method,
    status: success ? 'Paid' : 'Failed',
    provider: 'Simulated',
    transactionReference: success ? `SIM-${method.slice(0, 3).toUpperCase()}-${order.number}-${newId().slice(0, 8).toUpperCase()}` : null,
    failureReason: success ? null : 'Card declined (simulated failure).',
    createdAt: at,
    paidAt: success ? at : null,
    refundedAt: null,
  }
  order.payments.push(payment)
  // Compared in whole cents: decimal money in the API, binary floats here (100 + 218.67 ≠ 318.67).
  if (success && round2(paidSoFar + amount) >= order.total) order.paymentStatus = 'Paid'
  else if (!success && paidSoFar === 0) order.paymentStatus = 'Failed'
  order.updatedAt = at

  const orderResult =
    success && order.paymentStatus === 'Paid' && b.completeOrder && (order.status === 'Ready' || order.status === 'Served')
      ? changeStatus(order, 'Completed', user)
      : publishUpdated(order)

  // The masa is free the moment its bill is paid.
  if (success && order.paymentStatus === 'Paid' && releaseTable(order.tableId, order.id)) publish('tablesChanged')

  notify(
    'Payment',
    success ? `Payment received · #${order.number}` : `Payment failed · #${order.number}`,
    success ? `${amount.toFixed(2)} ${d.restaurant.currency} by ${method}` : payment.failureReason!,
    `/orders/${order.id}`,
  )
  return { payment: paymentDto(order, payment), order: orderResult }
})

route('POST', '/payments/:id/refund', (req) => {
  requireRoles(req, RoleGroups.management)
  const row = allPayments().find(({ payment }) => payment.id === req.params.id)
  if (!row) throw notFound('Payment', req.params.id)
  const { order, payment } = row
  if (payment.status !== 'Paid') throw conflict('Only paid payments can be refunded.')

  payment.status = 'Refunded'
  payment.refundedAt = now()
  const stillPaid = round2(sum(order.payments.filter((p) => p.status === 'Paid').map((p) => p.amount)))
  order.paymentStatus = stillPaid >= order.total ? 'Paid' : stillPaid > 0 ? 'Pending' : 'Refunded'
  order.updatedAt = payment.refundedAt
  return { payment: paymentDto(order, payment), order: publishUpdated(order) }
})
