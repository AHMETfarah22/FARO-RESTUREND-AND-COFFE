import { api } from './api'
import type {
  AuthResponse,
  Category,
  Customer,
  CustomerDetail,
  Dashboard,
  DiningTable,
  InventoryItem,
  InventoryTransaction,
  InventoryTransactionType,
  LicenseStatus,
  Order,
  OrderItemInput,
  OrderStatus,
  PagedResult,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentSummary,
  Product,
  PublicMenu,
  PublicRestaurant,
  PublicOrderStatus,
  Report,
  ReportGrouping,
  Reservation,
  ReservationStatus,
  Restaurant,
  RestaurantSettings,
  Role,
  StaffMember,
  SystemHealth,
  TableStatus,
  User,
} from '@/types/api'

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data)
type Signal = AbortSignal | undefined

// ---- Restaurant -------------------------------------------------------------
export interface RestaurantInput {
  name: string
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
}

export const restaurantApi = {
  current: (signal?: Signal) => data(api.get<Restaurant>('/restaurants/current', { signal })),
  publicInfo: (signal?: Signal) => data(api.get<PublicRestaurant>('/restaurants/public', { signal })),
  update: (id: string, input: RestaurantInput) => data(api.put<Restaurant>(`/restaurants/${id}`, input)),
  updateSettings: (input: RestaurantSettings) => data(api.put<Restaurant>('/restaurants/current/settings', input)),
  health: (signal?: Signal) => data(api.get<SystemHealth>('/health', { signal })),
}

// ---- Tables -----------------------------------------------------------------
export interface TableInput {
  number: number
  capacity: number
  location: string | null
  status: TableStatus
}

export const tablesApi = {
  list: (signal?: Signal) => data(api.get<DiningTable[]>('/tables', { signal })),
  get: (id: string, signal?: Signal) => data(api.get<DiningTable>(`/tables/${id}`, { signal })),
  create: (input: TableInput) => data(api.post<DiningTable>('/tables', input)),
  update: (id: string, input: TableInput) => data(api.put<DiningTable>(`/tables/${id}`, input)),
  setStatus: (id: string, status: TableStatus) => data(api.put<DiningTable>(`/tables/${id}/status`, { status })),
  remove: (id: string) => api.delete(`/tables/${id}`),
}

// ---- Menu -------------------------------------------------------------------
export interface CategoryInput {
  name: string
  description: string | null
  icon: string | null
  sortOrder: number
  isActive: boolean
}

export interface ProductInput {
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

export const categoriesApi = {
  list: (signal?: Signal) => data(api.get<Category[]>('/categories', { signal })),
  create: (input: CategoryInput) => data(api.post<Category>('/categories', input)),
  update: (id: string, input: CategoryInput) => data(api.put<Category>(`/categories/${id}`, input)),
  remove: (id: string) => api.delete(`/categories/${id}`),
}

export const productsApi = {
  list: (params: { search?: string; categoryId?: string; available?: boolean } = {}, signal?: Signal) =>
    data(api.get<Product[]>('/products', { params, signal })),
  create: (input: ProductInput) => data(api.post<Product>('/products', input)),
  update: (id: string, input: ProductInput) => data(api.put<Product>(`/products/${id}`, input)),
  remove: (id: string) => api.delete(`/products/${id}`),
}

export const publicMenuApi = {
  get: (tableId: string, signal?: Signal) => data(api.get<PublicMenu>(`/menu/tables/${tableId}`, { signal })),
  placeOrder: (tableId: string, input: { customerName?: string; phone?: string; notes?: string; items: OrderItemInput[] }) =>
    data(api.post<PublicOrderStatus>(`/menu/tables/${tableId}/orders`, input)),
  orderStatus: (orderId: string, signal?: Signal) => data(api.get<PublicOrderStatus>(`/menu/orders/${orderId}`, { signal })),
}

// ---- Orders -----------------------------------------------------------------
export interface OrderInput {
  tableId: string | null
  customerId: string | null
  customerName: string | null
  notes: string | null
  discount: number
  items: OrderItemInput[]
}

export interface OrderQuery {
  status?: OrderStatus[]
  from?: string
  to?: string
  search?: string
  tableId?: string
  paymentStatus?: PaymentStatus
  page?: number
  pageSize?: number
}

export const ordersApi = {
  list: (params: OrderQuery = {}, signal?: Signal) => data(api.get<PagedResult<Order>>('/orders', { params, signal })),
  get: (id: string, signal?: Signal) => data(api.get<Order>(`/orders/${id}`, { signal })),
  create: (input: OrderInput) => data(api.post<Order>('/orders', input)),
  update: (id: string, input: OrderInput) => data(api.put<Order>(`/orders/${id}`, input)),
  setStatus: (id: string, status: OrderStatus) => data(api.put<Order>(`/orders/${id}/status`, { status })),
  kitchen: (signal?: Signal) => data(api.get<Order[]>('/kitchen/orders', { signal })),
  mine: (signal?: Signal) => data(api.get<Order[]>('/customers/me/orders', { signal })),
}

// ---- Payments ---------------------------------------------------------------
export const paymentsApi = {
  list: (params: { from?: string; to?: string; status?: PaymentStatus; method?: PaymentMethod; page?: number; pageSize?: number }, signal?: Signal) =>
    data(api.get<PagedResult<Payment>>('/payments', { params, signal })),
  summary: (params: { from?: string; to?: string }, signal?: Signal) => data(api.get<PaymentSummary>('/payments/summary', { params, signal })),
  pay: (input: { orderId: string; method: PaymentMethod; amount?: number | null; simulateFailure: boolean; completeOrder: boolean }) =>
    data(api.post<{ payment: Payment; order: Order }>('/payments', input)),
  refund: (id: string) => data(api.post<{ payment: Payment; order: Order }>(`/payments/${id}/refund`)),
}

// ---- Reservations & customers ------------------------------------------------
export interface ReservationInput {
  customerName: string
  phone: string
  email: string | null
  date: string
  time: string
  partySize: number
  tableId: string | null
  status: ReservationStatus
  notes: string | null
}

export const reservationsApi = {
  list: (params: { from?: string; to?: string; status?: ReservationStatus; search?: string } = {}, signal?: Signal) =>
    data(api.get<Reservation[]>('/reservations', { params, signal })),
  create: (input: ReservationInput) => data(api.post<Reservation>('/reservations', input)),
  update: (id: string, input: ReservationInput) => data(api.put<Reservation>(`/reservations/${id}`, input)),
  setStatus: (id: string, status: ReservationStatus) => data(api.put<Reservation>(`/reservations/${id}/status`, { status })),
  remove: (id: string) => api.delete(`/reservations/${id}`),
}

export interface CustomerInput {
  name: string
  phone: string | null
  email: string | null
  notes: string | null
}

export const customersApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}, signal?: Signal) =>
    data(api.get<PagedResult<Customer>>('/customers', { params, signal })),
  get: (id: string, signal?: Signal) => data(api.get<CustomerDetail>(`/customers/${id}`, { signal })),
  create: (input: CustomerInput) => data(api.post<Customer>('/customers', input)),
  update: (id: string, input: CustomerInput) => data(api.put<Customer>(`/customers/${id}`, input)),
  remove: (id: string) => api.delete(`/customers/${id}`),
}

// ---- Staff ------------------------------------------------------------------
export interface StaffInput {
  fullName: string
  email: string
  userName: string
  phone: string | null
  role: Role
  isActive: boolean
  password?: string
}

export const staffApi = {
  list: (signal?: Signal) => data(api.get<StaffMember[]>('/staff', { signal })),
  create: (input: StaffInput & { password: string }) => data(api.post<StaffMember>('/staff', input)),
  update: (id: string, input: StaffInput) => data(api.put<StaffMember>(`/staff/${id}`, input)),
  resetPassword: (id: string, newPassword: string) => api.post(`/staff/${id}/reset-password`, { newPassword }),
  remove: (id: string) => api.delete(`/staff/${id}`),
}

// ---- Inventory --------------------------------------------------------------
export interface InventoryInput {
  name: string
  unit: string
  quantity: number
  minimumQuantity: number
  supplier: string | null
  purchasePrice: number
  sellingPrice: number | null
}

export const inventoryApi = {
  list: (params: { search?: string; lowStock?: boolean } = {}, signal?: Signal) => data(api.get<InventoryItem[]>('/inventory', { params, signal })),
  create: (input: InventoryInput) => data(api.post<InventoryItem>('/inventory', input)),
  update: (id: string, input: InventoryInput) => data(api.put<InventoryItem>(`/inventory/${id}`, input)),
  remove: (id: string) => api.delete(`/inventory/${id}`),
  move: (id: string, input: { type: InventoryTransactionType; quantity: number; note: string | null }) =>
    data(api.post<InventoryItem>(`/inventory/${id}/movements`, input)),
  transactions: (id: string, signal?: Signal) => data(api.get<InventoryTransaction[]>(`/inventory/${id}/transactions`, { signal })),
}

// ---- Reports / dashboard / account -------------------------------------------
export const reportsApi = {
  get: (params: { from?: string; to?: string; groupBy?: ReportGrouping }, signal?: Signal) => data(api.get<Report>('/reports', { params, signal })),
  dashboard: (signal?: Signal) => data(api.get<Dashboard>('/dashboard', { signal })),
}

export const accountApi = {
  updateProfile: (input: { fullName: string; phone: string | null }) => data(api.put<User>('/auth/profile', input)),
  changePassword: (input: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', input),
}

// ---- installation: license activation and first-run setup ------------------------------------------
export const licenseApi = {
  status: (signal?: Signal) => data(api.get<LicenseStatus>('/license', { signal })),
  activate: (key: string) => data(api.post<LicenseStatus>('/license', { key })),
}

export const setupApi = {
  status: (signal?: Signal) => data(api.get<{ required: boolean }>('/setup', { signal })),
  complete: (input: { restaurantName: string; fullName: string; email: string; password: string }) =>
    data(api.post<AuthResponse>('/setup', input)),
}
