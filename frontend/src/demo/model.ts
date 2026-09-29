import type {
  Category,
  Customer,
  DiningTable,
  InventoryItem,
  NotificationItem,
  NotificationType,
  Order,
  OrderStatus,
  Payment,
  Product,
  PublicOrderStatus,
  Reservation,
  Restaurant,
  StaffMember,
  User,
} from '@/types/api'
import {
  db,
  publish,
  type CategoryRow,
  type CustomerRow,
  type InventoryRow,
  type NotificationRow,
  type OrderRow,
  type PaymentRow,
  type ProductRow,
  type ReservationRow,
  type StaffRow,
  type TableRow,
  type UserRow,
} from './db'
import { notFound } from './http'
import { newId, round2, sum, tableName } from './util'

/* Row → DTO mappers: the JSON the real API returns for each entity. */

const CLOSED: OrderStatus[] = ['Completed', 'Cancelled']
export const isClosed = (status: OrderStatus) => CLOSED.includes(status)

export const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt)

export function find<T extends { id: string }>(rows: T[], id: string, entity: string): T {
  const row = rows.find((r) => r.id === id)
  if (!row) throw notFound(entity, id)
  return row
}

export const userDto = (u: UserRow): User => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  userName: u.userName,
  phone: u.phone,
  roles: [...u.roles],
  restaurantId: u.restaurantId,
})

export const restaurantDto = (): Restaurant => structuredClone(db().restaurant)

export function tableDto(t: TableRow): DiningTable {
  const open = db().orders.filter((o) => o.tableId === t.id && !isClosed(o.status))
  return {
    id: t.id,
    number: t.number,
    name: tableName(t.number),
    capacity: t.capacity,
    location: t.location,
    status: t.status,
    activeOrders: open.length,
    // Still to be paid on this masa (paid orders no longer count).
    openAmount: round2(sum(open.filter((o) => o.paymentStatus !== 'Paid').map((o) => o.total))),
  }
}

export const tableNameOf = (tableId: string | null) => {
  const table = tableId ? db().tables.find((t) => t.id === tableId) : undefined
  return table ? tableName(table.number) : null
}

export const categoryDto = (c: CategoryRow): Category => ({ ...c, productCount: db().products.filter((p) => p.categoryId === c.id).length })

export const productDto = (p: ProductRow): Product => ({
  ...p,
  categoryName: db().categories.find((c) => c.id === p.categoryId)?.name ?? '',
  images: [...p.images],
})

const itemDto = (o: OrderRow) => o.items.map((i) => ({ ...i, lineTotal: round2(i.unitPrice * i.quantity) }))

export function orderDto(o: OrderRow): Order {
  const customer = o.customerId ? db().customers.find((c) => c.id === o.customerId) : undefined
  return {
    id: o.id,
    number: o.number,
    tableId: o.tableId,
    tableName: tableNameOf(o.tableId),
    customerId: o.customerId,
    customerName: customer?.name ?? o.customerName,
    source: o.source,
    status: o.status,
    paymentStatus: o.paymentStatus,
    subtotal: o.subtotal,
    discount: o.discount,
    taxRate: o.taxRate,
    taxAmount: o.taxAmount,
    total: o.total,
    paidAmount: round2(sum(o.payments.filter((p) => p.status === 'Paid').map((p) => p.amount))),
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    completedAt: o.completedAt,
    items: itemDto(o),
    payments: o.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      transactionReference: p.transactionReference,
      createdAt: p.createdAt,
    })),
  }
}

/** What the customer sees when tracking an order from the QR menu. */
export const publicOrderDto = (o: OrderRow): PublicOrderStatus => ({
  id: o.id,
  number: o.number,
  tableName: tableNameOf(o.tableId),
  status: o.status,
  subtotal: o.subtotal,
  taxAmount: o.taxAmount,
  discount: o.discount,
  total: o.total,
  currency: db().restaurant.currency,
  createdAt: o.createdAt,
  items: itemDto(o),
})

export const paymentDto = (o: OrderRow, p: PaymentRow): Payment => ({
  id: p.id,
  orderId: o.id,
  orderNumber: o.number,
  tableName: tableNameOf(o.tableId),
  amount: p.amount,
  method: p.method,
  status: p.status,
  provider: p.provider,
  transactionReference: p.transactionReference,
  failureReason: p.failureReason,
  createdAt: p.createdAt,
  paidAt: p.paidAt,
  refundedAt: p.refundedAt,
})

export const reservationDto = (r: ReservationRow): Reservation => ({ ...r, tableName: tableNameOf(r.tableId) })

export function customerDto(c: CustomerRow): Customer {
  const orders = db().orders.filter((o) => o.customerId === c.id)
  const kept = orders.filter((o) => o.status !== 'Cancelled')
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    orderCount: kept.length,
    totalSpending: round2(sum(kept.filter((o) => o.paymentStatus === 'Paid').map((o) => o.total))),
    lastOrderAt: orders.reduce<string | null>((last, o) => (!last || o.createdAt > last ? o.createdAt : last), null),
    createdAt: c.createdAt,
  }
}

export const staffDto = (s: StaffRow): StaffMember => ({
  ...s,
  userName: db().users.find((u) => u.id === s.userId)?.userName ?? s.email,
})

export const inventoryDto = (i: InventoryRow): InventoryItem => ({
  id: i.id,
  name: i.name,
  unit: i.unit,
  quantity: i.quantity,
  minimumQuantity: i.minimumQuantity,
  supplier: i.supplier,
  purchasePrice: i.purchasePrice,
  sellingPrice: i.sellingPrice,
  isLowStock: i.quantity <= i.minimumQuantity,
  stockValue: round2(i.quantity * i.purchasePrice),
  updatedAt: i.updatedAt ?? i.createdAt,
})

export const notificationDto = (n: NotificationRow): NotificationItem => ({ ...n })

/** NotificationService.PublishAsync: stores a notification and pushes it to connected staff. */
export function notify(type: NotificationType, title: string, message: string, link: string | null) {
  const row: NotificationRow = { id: newId(), type, title, message, link, isRead: false, createdAt: new Date().toISOString() }
  db().notifications.push(row)
  publish('notification', notificationDto(row))
}
