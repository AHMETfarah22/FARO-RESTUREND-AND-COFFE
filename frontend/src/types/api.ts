// Types mirroring the backend DTOs (FaroRestaurant.Application). Enums are serialized as strings.

export type Role = 'SuperAdmin' | 'RestaurantAdmin' | 'Manager' | 'Waiter' | 'Kitchen' | 'Cashier' | 'Customer'
export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning' | 'Disabled'
export type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Ready' | 'Served' | 'Completed' | 'Cancelled'
export type OrderSource = 'Staff' | 'QrMenu'
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded'
export type PaymentMethod = 'Cash' | 'Card' | 'Online' | 'Test'
export type ReservationStatus = 'Pending' | 'Confirmed' | 'Arrived' | 'Completed' | 'Cancelled'
export type NotificationType = 'NewOrder' | 'Reservation' | 'LowStock' | 'Payment' | 'System'
export type InventoryTransactionType = 'StockIn' | 'StockOut' | 'Adjustment'
export type ReportGrouping = 'Day' | 'Week' | 'Month' | 'Year'
export type ReportSection = 'Sales' | 'Products' | 'Categories' | 'Payments' | 'Orders' | 'Reservations' | 'Inventory'
export type ExportFormat = 'Csv' | 'Xlsx' | 'Pdf'

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface User {
  id: string
  fullName: string
  email: string
  userName: string
  phone: string | null
  roles: Role[]
  restaurantId: string | null
}

export interface AuthResponse {
  accessToken: string
  expiresAtUtc: string
  user: User
}

export interface RestaurantSettings {
  qrOrderingEnabled: boolean
  autoConfirmQrOrders: boolean
  qrMenuBaseUrl: string | null
  defaultPreparationMinutes: number
  newOrderSound: boolean
  lowStockAlerts: boolean
  reservationAlerts: boolean
  enabledPaymentMethods: PaymentMethod[]
}

export interface Restaurant {
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

export interface PublicRestaurant {
  name: string
  logoUrl: string | null
  coverImageUrl: string | null
  description: string | null
}

export interface DiningTable {
  id: string
  number: number
  name: string
  capacity: number
  location: string | null
  status: TableStatus
  activeOrders: number
  openAmount: number
}

export interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
  productCount: number
}

export interface Product {
  id: string
  categoryId: string
  categoryName: string
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

export interface OrderItem {
  id: string
  productId: string | null
  productName: string
  unitPrice: number
  quantity: number
  notes: string | null
  lineTotal: number
}

export interface OrderPayment {
  id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  transactionReference: string | null
  createdAt: string
}

export interface Order {
  id: string
  number: number
  tableId: string | null
  tableName: string | null
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
  paidAmount: number
  notes: string | null
  createdAt: string
  updatedAt: string | null
  completedAt: string | null
  items: OrderItem[]
  payments: OrderPayment[]
}

export interface OrderItemInput {
  productId: string
  quantity: number
  notes?: string | null
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  orderCount: number
  totalSpending: number
  lastOrderAt: string | null
  createdAt: string
}

export interface Reservation {
  id: string
  customerId: string | null
  customerName: string
  phone: string
  email: string | null
  date: string
  time: string
  partySize: number
  tableId: string | null
  tableName: string | null
  status: ReservationStatus
  notes: string | null
  createdAt: string
}

export interface CustomerDetail {
  customer: Customer
  orders: Order[]
  reservations: Reservation[]
}

export interface StaffMember {
  id: string
  userId: string
  fullName: string
  email: string
  userName: string
  phone: string | null
  role: Role
  isActive: boolean
  hiredOn: string
  createdAt: string
}

export interface InventoryItem {
  id: string
  name: string
  unit: string
  quantity: number
  minimumQuantity: number
  supplier: string | null
  purchasePrice: number
  sellingPrice: number | null
  isLowStock: boolean
  stockValue: number
  updatedAt: string | null
}

export interface InventoryTransaction {
  id: string
  type: InventoryTransactionType
  quantityChange: number
  quantityAfter: number
  note: string | null
  createdAt: string
}

export interface Payment {
  id: string
  orderId: string
  orderNumber: number
  tableName: string | null
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

export interface PaymentSummary {
  paidTotal: number
  refundedTotal: number
  paidCount: number
  failedCount: number
  byMethod: Record<PaymentMethod, number>
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationList {
  items: NotificationItem[]
  unreadCount: number
}

export interface SalesPoint {
  label: string
  periodStart: string
  revenue: number
  orders: number
}

export interface ProductSales {
  productName: string
  categoryName: string
  quantity: number
  revenue: number
}

export interface CategorySales {
  categoryName: string
  quantity: number
  revenue: number
}

export interface InventoryReportRow {
  name: string
  unit: string
  quantity: number
  minimumQuantity: number
  stockValue: number
  isLowStock: boolean
}

export interface StatusCount {
  status: string
  count: number
}

export interface Report {
  from: string
  to: string
  groupBy: ReportGrouping
  currency: string
  totals: {
    revenue: number
    orders: number
    cancelledOrders: number
    averageOrderValue: number
    tax: number
    discounts: number
    itemsSold: number
    reservations: number
    guests: number
  }
  sales: SalesPoint[]
  products: ProductSales[]
  categories: CategorySales[]
  payments: { method: PaymentMethod; count: number; amount: number }[]
  orderStatuses: StatusCount[]
  reservationStatuses: StatusCount[]
  inventory: InventoryReportRow[]
}

export interface Kpi {
  value: number
  changePercent: number | null
}

export interface Dashboard {
  currency: string
  todaySales: Kpi
  todayOrders: Kpi
  pendingOrders: number
  completedOrders: number
  todayReservations: number
  availableTables: number
  occupiedTables: number
  totalTables: number
  lowStockCount: number
  last7Days: SalesPoint[]
  popularProducts: ProductSales[]
  categorySales: CategorySales[]
  lowStockItems: InventoryReportRow[]
  recentOrders: Order[]
}

export interface PublicMenuProduct {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  isFeatured: boolean
  inStock: boolean
  preparationMinutes: number
}

export interface PublicMenu {
  restaurantName: string
  logoUrl: string | null
  coverImageUrl: string | null
  description: string | null
  currency: string
  taxRate: number
  openingTime: string
  closingTime: string
  tableId: string
  tableName: string
  orderingEnabled: boolean
  categories: { id: string; name: string; icon: string | null; products: PublicMenuProduct[] }[]
}

export interface PublicOrderStatus {
  id: string
  number: number
  tableName: string | null
  status: OrderStatus
  subtotal: number
  taxAmount: number
  discount: number
  total: number
  currency: string
  createdAt: string
  items: OrderItem[]
}

export type LicenseState = 'Active' | 'Missing' | 'Invalid' | 'Expired' | 'OtherMachine'

/** GET /api/license — the machine code is what the customer sends to the seller for a license key. */
export interface LicenseStatus {
  status: LicenseState
  machineCode: string
  customer: string | null
  licenseId: string | null
  issuedOn: string | null
  expiresOn: string | null
}

export interface SystemHealth {
  application: string
  status: 'Healthy' | 'Degraded'
  environment: string
  database: {
    connected: boolean
    provider: string
    serverVersion: string | null
    pendingMigrations: number
    restaurantCount: number
    roleCount: number
    error: string | null
  }
  serverTimeUtc: string
}
