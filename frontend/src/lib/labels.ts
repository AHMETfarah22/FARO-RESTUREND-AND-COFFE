import type {
  InventoryTransactionType,
  NotificationType,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReportGrouping,
  ReservationStatus,
  Role,
  TableStatus,
} from '@/types/api'
import { translate } from './i18n'

/** Display names for the API's enum values, in the portal language ("Paid" → "Ödendi"). */
export const orderStatusLabel = (s: OrderStatus) => translate(`order|${s}`)
export const paymentStatusLabel = (s: PaymentStatus) => translate(`payment|${s === 'Pending' ? 'Unpaid' : s}`)
export const tableStatusLabel = (s: TableStatus) => translate(`table|${s}`)
export const reservationStatusLabel = (s: ReservationStatus) => translate(`reservation|${s}`)
export const paymentMethodLabel = (m: PaymentMethod) => translate(`method|${m}`)
export const orderSourceLabel = (s: OrderSource) => translate(`source|${s === 'QrMenu' ? 'QR menu' : 'Staff'}`)
export const notificationTypeLabel = (n: NotificationType) =>
  translate(`notification|${{ NewOrder: 'New order', Reservation: 'Reservation', LowStock: 'Low stock', Payment: 'Payment', System: 'System' }[n]}`)
export const inventoryMoveLabel = (m: InventoryTransactionType) =>
  translate(`stock|${{ StockIn: 'Stock in', StockOut: 'Stock out', Adjustment: 'Count' }[m]}`)
export const groupingLabel = (g: ReportGrouping) => translate(`group|${{ Day: 'Daily', Week: 'Weekly', Month: 'Monthly', Year: 'Yearly' }[g]}`)

const roleNames: Record<Role, string> = {
  SuperAdmin: 'Super Admin',
  RestaurantAdmin: 'Restaurant Admin',
  Manager: 'Manager',
  Waiter: 'Waiter',
  Kitchen: 'Kitchen Staff',
  Cashier: 'Cashier',
  Customer: 'Customer',
}
export const roleLabel = (r: Role) => translate(`role|${roleNames[r]}`)
