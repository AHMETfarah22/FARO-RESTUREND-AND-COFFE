import {
  BarChart3,
  Bell,
  Boxes,
  CalendarDays,
  ChefHat,
  ClipboardList,
  ConciergeBell,
  CreditCard,
  LayoutDashboard,
  Settings,
  Store,
  Table2,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Permission, Workspace } from '@/lib/permissions'

export interface NavLeaf {
  label: string
  to: string
  permission: Permission
  /** Match the path exactly (for parents of other routes). */
  end?: boolean
}

export interface NavItem extends Partial<NavLeaf> {
  label: string
  icon: LucideIcon
  children?: NavLeaf[]
}

// ---- Building blocks ---------------------------------------------------------
const dashboard: NavItem = { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', permission: 'dashboard' }
const service: NavItem = { label: 'Service', icon: ConciergeBell, to: '/service', permission: 'serviceBoard' }
const cashDesk: NavItem = { label: 'Cash desk', icon: Wallet, to: '/cash-desk', permission: 'cashDesk' }
const kitchen: NavItem = { label: 'Kitchen', icon: ChefHat, to: '/kitchen', permission: 'kitchen' }
const stations: NavItem = {
  label: 'Stations',
  icon: ConciergeBell,
  children: [
    { label: 'Service (waiters)', to: '/service', permission: 'serviceBoard' },
    { label: 'Cash desk (cashier)', to: '/cash-desk', permission: 'cashDesk' },
    { label: 'Kitchen display', to: '/kitchen', permission: 'kitchen' },
  ],
}
const restaurant: NavItem = {
  label: 'Restaurant',
  icon: Store,
  children: [
    { label: 'Restaurant Info', to: '/restaurant', permission: 'restaurantSettings' },
    { label: 'Tables', to: '/tables', permission: 'tablesView', end: true },
    { label: 'QR Codes', to: '/qr-codes', permission: 'tablesManage' },
  ],
}
const tables: NavItem = { label: 'Tables', icon: Table2, to: '/tables', permission: 'tablesView', end: true }
const menu: NavItem = {
  label: 'Menu',
  icon: UtensilsCrossed,
  children: [
    { label: 'Categories', to: '/categories', permission: 'menuManage' },
    { label: 'Products', to: '/products', permission: 'menuManage' },
  ],
}
const orders: NavItem = {
  label: 'Orders',
  icon: ClipboardList,
  children: [
    { label: 'All Orders', to: '/orders', permission: 'ordersView', end: true },
    { label: 'Pending', to: '/orders/pending', permission: 'ordersView' },
    { label: 'Preparing', to: '/orders/preparing', permission: 'ordersView' },
    { label: 'Completed', to: '/orders/completed', permission: 'ordersView' },
  ],
}
const ordersFlat: NavItem = { label: 'Orders', icon: ClipboardList, to: '/orders', permission: 'ordersView' }
const reservations: NavItem = { label: 'Reservations', icon: CalendarDays, to: '/reservations', permission: 'reservations' }
const customers: NavItem = { label: 'Customers', icon: Users, to: '/customers', permission: 'customers' }
const staff: NavItem = { label: 'Staff', icon: UserCog, to: '/staff', permission: 'staff' }
const inventory: NavItem = { label: 'Inventory', icon: Boxes, to: '/inventory', permission: 'inventory' }
const payments: NavItem = { label: 'Payments', icon: CreditCard, to: '/payments', permission: 'payments' }
const reports: NavItem = { label: 'Reports', icon: BarChart3, to: '/reports', permission: 'reports' }
const notifications: NavItem = { label: 'Notifications', icon: Bell, to: '/notifications', permission: 'notifications' }
const settings: NavItem = { label: 'Settings', icon: Settings, to: '/settings', permission: 'settings' }

/**
 * Each workspace only shows the tools for its own duties, in the order that role uses them.
 * Labels are English source texts, translated where they are shown.
 * Items are still filtered by permission, so the API rules stay the single source of truth.
 */
export const navigationByWorkspace: Record<Workspace, NavItem[]> = {
  admin: [dashboard, stations, restaurant, menu, orders, reservations, customers, staff, inventory, payments, reports, notifications, settings],
  manager: [dashboard, stations, restaurant, menu, orders, reservations, customers, staff, inventory, payments, reports, notifications, settings],
  waiter: [service, tables, ordersFlat, reservations, customers, notifications, settings],
  cashier: [cashDesk, payments, ordersFlat, tables, customers, notifications, settings],
  kitchen: [kitchen, notifications, settings],
  customer: [],
}

/** Mobile bottom bar: the four things each role reaches for most. */
export const bottomNavByWorkspace: Record<Workspace, { to: string; label: string; icon: LucideIcon; permission: Permission }[]> = {
  admin: [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard, permission: 'dashboard' },
    { to: '/orders', label: 'Orders', icon: ClipboardList, permission: 'ordersView' },
    { to: '/tables', label: 'Tables', icon: Table2, permission: 'tablesView' },
    { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports' },
  ],
  manager: [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard, permission: 'dashboard' },
    { to: '/orders', label: 'Orders', icon: ClipboardList, permission: 'ordersView' },
    { to: '/tables', label: 'Tables', icon: Table2, permission: 'tablesView' },
    { to: '/kitchen', label: 'Kitchen', icon: ChefHat, permission: 'kitchen' },
  ],
  waiter: [
    { to: '/service', label: 'Service', icon: ConciergeBell, permission: 'serviceBoard' },
    { to: '/tables', label: 'Tables', icon: Table2, permission: 'tablesView' },
    { to: '/orders', label: 'Orders', icon: ClipboardList, permission: 'ordersView' },
    { to: '/reservations', label: 'Reservations', icon: CalendarDays, permission: 'reservations' },
  ],
  cashier: [
    { to: '/cash-desk', label: 'Cash desk', icon: Wallet, permission: 'cashDesk' },
    { to: '/payments', label: 'Payments', icon: CreditCard, permission: 'payments' },
    { to: '/orders', label: 'Orders', icon: ClipboardList, permission: 'ordersView' },
    { to: '/tables', label: 'Tables', icon: Table2, permission: 'tablesView' },
  ],
  kitchen: [
    { to: '/kitchen', label: 'Kitchen', icon: ChefHat, permission: 'kitchen' },
    { to: '/notifications', label: 'Alerts', icon: Bell, permission: 'notifications' },
    { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings' },
  ],
  customer: [],
}
