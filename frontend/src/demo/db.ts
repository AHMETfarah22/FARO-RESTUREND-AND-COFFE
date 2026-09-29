import type {
  InventoryTransactionType,
  NotificationType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  RestaurantSettings,
  Role,
  TableStatus,
} from '@/types/api'
import { toIsoDate } from '@/lib/format'
import { createSeed } from './seed'

/*
 * The demo "database": the same tables as the PostgreSQL schema, kept as one JSON document in localStorage.
 * Every visitor gets a private copy, so they can click everything without affecting anyone else.
 * Tabs of the same browser share it (and its live events), e.g. the QR menu in one tab and the kitchen in another.
 */

export interface RestaurantRow {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  coverImageUrl: string | null
  phone: string | null
  email: string | null
  address: string | null
  description: string | null
  openingTime: string
  closingTime: string
  currency: string
  taxRate: number
  isActive: boolean
  settings: RestaurantSettings
}

export interface UserRow {
  id: string
  fullName: string
  email: string
  userName: string
  phone: string | null
  roles: Role[]
  restaurantId: string | null
  /** Demo only — the data never leaves the visitor's browser. */
  password: string
  isActive: boolean
}

export interface StaffRow {
  id: string
  userId: string
  fullName: string
  email: string
  phone: string | null
  role: Role
  isActive: boolean
  hiredOn: string
  createdAt: string
}

export interface TableRow {
  id: string
  number: number
  capacity: number
  location: string | null
  status: TableStatus
}

export interface CategoryRow {
  id: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
}

export interface ProductRow {
  id: string
  categoryId: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  sku: string
  stock: number | null
  isAvailable: boolean
  isFeatured: boolean
  preparationMinutes: number
  images: string[]
}

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  userId: string | null
  createdAt: string
}

export interface OrderItemRow {
  id: string
  productId: string | null
  productName: string
  unitPrice: number
  quantity: number
  notes: string | null
}

export interface PaymentRow {
  id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  provider: string
  transactionReference: string | null
  failureReason: string | null
  createdAt: string
  paidAt: string | null
  refundedAt: string | null
}

export interface OrderRow {
  id: string
  number: number
  tableId: string | null
  customerId: string | null
  customerName: string | null
  source: OrderSource
  status: OrderStatus
  paymentStatus: PaymentStatus
  subtotal: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  notes: string | null
  createdAt: string
  updatedAt: string | null
  completedAt: string | null
  items: OrderItemRow[]
  payments: PaymentRow[]
}

export interface ReservationRow {
  id: string
  customerId: string | null
  customerName: string
  phone: string
  email: string | null
  date: string
  /** HH:mm:ss, as the API returns TimeOnly. */
  time: string
  partySize: number
  tableId: string | null
  status: ReservationStatus
  notes: string | null
  createdAt: string
}

export interface InventoryRow {
  id: string
  name: string
  unit: string
  quantity: number
  minimumQuantity: number
  supplier: string | null
  purchasePrice: number
  sellingPrice: number | null
  createdAt: string
  updatedAt: string | null
}

export interface InventoryTransactionRow {
  id: string
  itemId: string
  type: InventoryTransactionType
  quantityChange: number
  quantityAfter: number
  note: string | null
  createdAt: string
}

export interface NotificationRow {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface Db {
  version: number
  /** Local date the sample data was generated for; "today's" orders are regenerated on a new day. */
  seededOn: string
  nextOrderNumber: number
  restaurant: RestaurantRow
  users: UserRow[]
  staff: StaffRow[]
  tables: TableRow[]
  categories: CategoryRow[]
  products: ProductRow[]
  customers: CustomerRow[]
  orders: OrderRow[]
  reservations: ReservationRow[]
  inventory: InventoryRow[]
  inventoryTransactions: InventoryTransactionRow[]
  notifications: NotificationRow[]
}

/** Bump when the shape of Db or the sample data changes, so visitors get fresh data. */
const VERSION = 2
const KEY = 'faro.demo.db'

let cache: Db | null = null

function load(): Db | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Db
    return stored.version === VERSION && stored.seededOn === toIsoDate(new Date()) ? stored : null
  } catch {
    return null
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* storage full or blocked (private mode) — the data lasts until the page is reloaded */
  }
}

/** The current data (loaded or generated on first use). */
export function db(): Db {
  if (!cache) {
    cache = load()
    if (!cache) {
      cache = createSeed(new Date(), VERSION)
      save()
    }
  }
  return cache
}

/** Events raised inside the running transaction; sent only once it is saved. */
let pending: [string, unknown][] | null = null

/** Runs a change like a database transaction: saved when it succeeds, rolled back when it throws. */
export function transaction<T>(change: () => T): T {
  const before = structuredClone(db())
  pending = []
  try {
    const result = change()
    save()
    const events = pending
    pending = null
    events.forEach(([event, payload]) => send(event, payload))
    return result
  } catch (error) {
    cache = before
    pending = null
    throw error
  }
}

/** Starts over with fresh sample data. */
export function resetDb() {
  cache = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  channel?.postMessage({ reset: true })
}

// ---- live events (the in-browser SignalR) -----------------------------------------------------

type Listener = (event: string, payload: unknown) => void

const listeners = new Set<Listener>()
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('faro.demo')

function deliver(event: string, payload: unknown) {
  listeners.forEach((listener) => listener(event, payload))
}

// Another tab changed the data: forget our copy (the next request reloads it) and replay its event here.
channel?.addEventListener('message', (e: MessageEvent<{ event?: string; payload?: unknown; reset?: boolean }>) => {
  cache = null
  if (e.data.event) deliver(e.data.event, e.data.payload)
})
window.addEventListener('storage', (e) => {
  if (e.key === KEY) cache = null
})

function send(event: string, payload: unknown) {
  setTimeout(() => deliver(event, payload), 0) // after the request has returned, like SignalR
  channel?.postMessage({ event, payload })
}

/** Raises a hub event for this tab and the other open tabs (once the current change is saved). */
export function publish(event: string, payload?: unknown) {
  if (pending) pending.push([event, payload])
  else send(event, payload)
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
