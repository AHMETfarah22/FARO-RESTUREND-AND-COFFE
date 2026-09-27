import type { ComponentType, ReactNode } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { useAuth, useWorkspace } from '@/features/auth/AuthContext'
import { GuestOnly, HomeRedirect, RequireAuth, RequirePermission } from '@/features/auth/RouteGuards'
import { RealtimeProvider } from '@/features/realtime/RealtimeContext'
import { RestaurantProvider } from '@/features/restaurant/RestaurantContext'
import { useWorkspaceTheme } from '@/features/theme/useWorkspaceTheme'
import { AdminLayout } from '@/layouts/AdminLayout'
import type { Permission } from '@/lib/permissions'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RouteError } from './RouteError'

type Module = Record<string, ComponentType>
type Wrap = (page: ReactNode) => ReactNode

/** Lazily loads a page module (code splitting) and wraps it (permission / guest guard). */
function page(load: () => Promise<Module>, name: string, wrap?: Wrap) {
  return {
    lazy: async () => {
      const Component = (await load())[name]
      return { Component: wrap ? () => <>{wrap(<Component />)}</> : Component }
    },
  }
}

const needs = (permission: Permission): Wrap => (p) => <RequirePermission permission={permission}>{p}</RequirePermission>
const guest: Wrap = (p) => <GuestOnly>{p}</GuestOnly>

/** Signed-in area: restaurant data, live SignalR connection (staff only) and the role's colour theme. */
function StaffShell() {
  const { user } = useAuth()
  const isStaff = !!user && user.roles.some((r) => r !== 'Customer')
  useWorkspaceTheme(useWorkspace())
  return (
    <RestaurantProvider>
      <RealtimeProvider enabled={isStaff}>
        <Outlet />
      </RealtimeProvider>
    </RestaurantProvider>
  )
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <HomeRedirect /> },
      { path: '/login', ...page(() => import('@/pages/auth/LoginPage'), 'LoginPage', guest) },
      { path: '/register', ...page(() => import('@/pages/auth/RegisterPage'), 'RegisterPage', guest) },

      // Public QR menu — no login required.
      { path: '/menu/table/:tableId', ...page(() => import('@/pages/menu/PublicMenuPage'), 'PublicMenuPage') },
      { path: '/menu/orders', ...page(() => import('@/pages/menu/CustomerOrdersPage'), 'CustomerOrdersPage') },

      {
        element: (
          <RequireAuth>
            <StaffShell />
          </RequireAuth>
        ),
        children: [
          // Full-screen Kitchen Display System (outside the admin layout).
          { path: '/kitchen', ...page(() => import('@/pages/kitchen/KitchenPage'), 'KitchenPage', needs('kitchen')) },
          { path: '/my-orders', ...page(() => import('@/pages/MyOrdersPage'), 'MyOrdersPage') },
          {
            element: <AdminLayout />,
            children: [
              { path: '/dashboard', ...page(() => import('@/pages/DashboardPage'), 'DashboardPage', needs('dashboard')) },
              { path: '/service', ...page(() => import('@/pages/workspaces/ServicePage'), 'ServicePage', needs('serviceBoard')) },
              { path: '/cash-desk', ...page(() => import('@/pages/workspaces/CashDeskPage'), 'CashDeskPage', needs('cashDesk')) },
              { path: '/restaurant', ...page(() => import('@/pages/restaurant/RestaurantPage'), 'RestaurantPage', needs('restaurantSettings')) },
              { path: '/tables', ...page(() => import('@/pages/tables/TablesPage'), 'TablesPage', needs('tablesView')) },
              { path: '/tables/:id/qr', ...page(() => import('@/pages/tables/TableQrPage'), 'TableQrPage', needs('tablesView')) },
              { path: '/qr-codes', ...page(() => import('@/pages/tables/QrCodesPage'), 'QrCodesPage', needs('tablesManage')) },
              { path: '/categories', ...page(() => import('@/pages/menu/CategoriesPage'), 'CategoriesPage', needs('menuManage')) },
              { path: '/products', ...page(() => import('@/pages/menu/ProductsPage'), 'ProductsPage', needs('menuManage')) },
              { path: '/orders', ...page(() => import('@/pages/orders/OrdersPage'), 'OrdersPage', needs('ordersView')) },
              { path: '/orders/new', ...page(() => import('@/pages/orders/OrderEditorPage'), 'OrderEditorPage', needs('ordersCreate')) },
              { path: '/orders/:id/edit', ...page(() => import('@/pages/orders/OrderEditorPage'), 'OrderEditorPage', needs('ordersCreate')) },
              { path: '/orders/:param', ...page(() => import('@/pages/orders/OrderRoute'), 'OrderRoute', needs('ordersView')) },
              { path: '/reservations', ...page(() => import('@/pages/reservations/ReservationsPage'), 'ReservationsPage', needs('reservations')) },
              { path: '/customers', ...page(() => import('@/pages/customers/CustomersPage'), 'CustomersPage', needs('customers')) },
              { path: '/customers/:id', ...page(() => import('@/pages/customers/CustomerDetailPage'), 'CustomerDetailPage', needs('customers')) },
              { path: '/staff', ...page(() => import('@/pages/staff/StaffPage'), 'StaffPage', needs('staff')) },
              { path: '/inventory', ...page(() => import('@/pages/inventory/InventoryPage'), 'InventoryPage', needs('inventory')) },
              { path: '/payments', ...page(() => import('@/pages/payments/PaymentsPage'), 'PaymentsPage', needs('payments')) },
              { path: '/reports', ...page(() => import('@/pages/reports/ReportsPage'), 'ReportsPage', needs('reports')) },
              { path: '/notifications', ...page(() => import('@/pages/NotificationsPage'), 'NotificationsPage', needs('notifications')) },
              { path: '/settings', ...page(() => import('@/pages/settings/SettingsPage'), 'SettingsPage', needs('settings')) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], {
  basename: import.meta.env.BASE_URL,
})
