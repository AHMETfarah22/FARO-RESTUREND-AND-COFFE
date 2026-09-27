import type { OrderStatus, Role } from '@/types/api'

/**
 * Who may use what. Mirrors RoleGroups / OrderDuties in FaroRestaurant.Domain/Constants/Roles.cs.
 * The API enforces these rules; the frontend uses them to hide what a user cannot use.
 *
 * Duties are split per role:
 *  - Waiter  → masalar, taking orders, serving ready plates, reservations
 *  - Kitchen → the kitchen display: accept, cook, mark ready
 *  - Cashier → taking payments and closing orders
 *  - Manager / admins → everything, plus reports, staff, stock and settings
 */
const admins: Role[] = ['SuperAdmin', 'RestaurantAdmin']
const management: Role[] = [...admins, 'Manager']
const allStaff: Role[] = [...management, 'Waiter', 'Kitchen', 'Cashier']

export const permissions = {
  dashboard: management,
  serviceBoard: [...management, 'Waiter'],
  cashDesk: [...management, 'Cashier'],
  restaurantSettings: admins,
  tablesView: [...management, 'Waiter', 'Cashier'],
  tablesManage: management,
  menuManage: management,
  // Order pages. The kitchen works from its own display (the API still lets it read orders).
  ordersView: [...management, 'Waiter', 'Cashier'],
  ordersCreate: [...management, 'Waiter'],
  kitchen: [...management, 'Kitchen'],
  reservations: [...management, 'Waiter'],
  customers: [...management, 'Waiter', 'Cashier'],
  customersDelete: management,
  staff: management,
  inventory: management,
  payments: [...management, 'Cashier'],
  refunds: management,
  reports: management,
  notifications: allStaff,
  settings: allStaff,
} satisfies Record<string, Role[]>

export type Permission = keyof typeof permissions

export function hasPermission(roles: readonly Role[] | undefined, permission: Permission) {
  return !!roles?.some((r) => (permissions[permission] as Role[]).includes(r))
}

/** Which roles (besides management) may move an order into each status. Mirrors OrderDuties (backend). */
const orderDuties: Partial<Record<OrderStatus, Role[]>> = {
  Confirmed: ['Waiter', 'Kitchen'],
  Preparing: ['Kitchen'],
  Ready: ['Kitchen'],
  Served: ['Waiter'],
  Completed: ['Cashier'],
  Cancelled: ['Waiter'],
}

export function canMoveOrderTo(roles: readonly Role[] | undefined, status: OrderStatus) {
  if (!roles) return false
  if (roles.some((r) => management.includes(r))) return true
  return roles.some((r) => orderDuties[status]?.includes(r))
}

/** A role's workspace: its own home page, colour theme and title. */
export type Workspace = 'admin' | 'manager' | 'waiter' | 'cashier' | 'kitchen' | 'customer'

/** Titles are English source texts (shown through t()). `themeColor` tints the phone's browser bar; `accent` is the workspace colour. */
export const workspaces: Record<Workspace, { home: string; title: string; subtitle: string; themeColor: string; accent: string }> = {
  admin: { home: '/dashboard', title: 'Administration', subtitle: 'Admin', themeColor: '#0a0a0a', accent: '#c9a45c' },
  manager: { home: '/dashboard', title: 'Manager panel', subtitle: 'Manager', themeColor: '#1e1b4b', accent: '#4338ca' },
  waiter: { home: '/service', title: 'Service', subtitle: 'Waiter', themeColor: '#06291f', accent: '#047857' },
  cashier: { home: '/cash-desk', title: 'Cash desk', subtitle: 'Cashier', themeColor: '#241046', accent: '#6d28d9' },
  kitchen: { home: '/kitchen', title: 'Kitchen', subtitle: 'Kitchen', themeColor: '#23120a', accent: '#c2410c' },
  customer: { home: '/my-orders', title: 'Customer', subtitle: 'Customer', themeColor: '#e0f2fe', accent: '#0279c2' },
}

/** The workspace for a user (the most senior role wins when someone has several). */
export function workspaceFor(roles: readonly Role[]): Workspace {
  if (roles.includes('SuperAdmin') || roles.includes('RestaurantAdmin')) return 'admin'
  if (roles.includes('Manager')) return 'manager'
  if (roles.includes('Cashier')) return 'cashier'
  if (roles.includes('Waiter')) return 'waiter'
  if (roles.includes('Kitchen')) return 'kitchen'
  return 'customer'
}

/** Where each role lands after login. */
export function homePathFor(roles: readonly Role[]) {
  return workspaces[workspaceFor(roles)].home
}

const linkPermissions: [prefix: string, permission: Permission][] = [
  ['/orders', 'ordersView'],
  ['/reservations', 'reservations'],
  ['/inventory', 'inventory'],
  ['/payments', 'payments'],
]

/** Where a notification link should take this user: its page, or their own home when that page is not part of their job. */
export function notificationTarget(roles: readonly Role[] | undefined, link: string) {
  const rule = linkPermissions.find(([prefix]) => link.startsWith(prefix))
  return !rule || hasPermission(roles, rule[1]) ? link : homePathFor(roles ?? [])
}
