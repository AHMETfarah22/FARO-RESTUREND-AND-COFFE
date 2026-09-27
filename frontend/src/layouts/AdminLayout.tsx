import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LogOut, Menu, MoreHorizontal, Plus, Settings, UserRound, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { LangToggle } from '@/components/LangToggle'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAuth, useWorkspace } from '@/features/auth/AuthContext'
import { localizeNotification } from '@/features/notifications/localize'
import { useRealtimeEvent, useRealtimeStatus } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { roleLabel } from '@/lib/labels'
import { sizedImage } from '@/lib/images'
import { notificationTarget, workspaces, type Permission } from '@/lib/permissions'
import { playChime } from '@/lib/sound'
import type { NotificationItem, Order } from '@/types/api'
import { NotificationBell } from './NotificationBell'
import { bottomNavByWorkspace } from './navigation'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'faro.sidebar.collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** Desktop: sidebar in the role's colour + content. Mobile: top bar with drawer + bottom navigation. */
export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const { can, user } = useAuth()
  const { restaurant } = useRestaurant()
  const cover = sizedImage(restaurant?.coverImageUrl, 1400)
  const coverStyle = (cover ? { '--cover-image': `url("${cover}")` } : undefined) as CSSProperties | undefined

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setDrawerOpen(false)
  }

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !c
    })
  }

  // Live alerts for staff anywhere in the portal.
  const { t } = useI18n()
  useRealtimeEvent<NotificationItem>('notification', (item) => {
    const n = localizeNotification(item)
    if (location.pathname === '/kitchen') return // the kitchen display has its own alerts
    toast.notify(n.title, n.message, n.link ? { label: t('Open'), onClick: () => navigate(notificationTarget(user?.roles, n.link!)) } : undefined)
  })
  useRealtimeEvent<Order>('orderCreated', () => {
    if (restaurant?.settings.newOrderSound !== false && location.pathname !== '/kitchen') playChime()
  })

  return (
    // The restaurant photo is shared with every page header (PageHeader reads --cover-image).
    <div className="min-h-dvh bg-surface" style={coverStyle}>
      {/* Desktop sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block print:hidden', collapsed ? 'w-20' : 'w-64')}>
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute top-6 right-3 z-10 rounded-lg p-2 text-paper/70 hover:text-paper" aria-label={t('Close menu')}>
              <X className="size-5" />
            </button>
            <Sidebar collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200 print:pl-0', collapsed ? 'lg:pl-20' : 'lg:pl-64')}>
        <TopBar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10 print:p-0">
          <Outlet />
        </main>
      </div>

      <BottomNav onMore={() => setDrawerOpen(true)} can={can} />
    </div>
  )
}

function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { can } = useAuth()
  const { t } = useI18n()
  const workspace = useWorkspace()
  const status = useRealtimeStatus()
  const { restaurant } = useRestaurant()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/90 px-4 shadow-[inset_0_3px_0_var(--color-brand)] backdrop-blur sm:px-6 lg:h-20 lg:px-8 print:hidden">
      <button type="button" onClick={onOpenMenu} className="-ml-2 rounded-xl p-2 text-ink hover:bg-surface lg:hidden" aria-label={t('Open menu')}>
        <Menu className="size-6" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink lg:text-base">{restaurant?.name ?? 'FARO RESTURENT AND COFFE'}</span>
          <span className="hidden shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-brand-ink sm:inline">
            {t(workspaces[workspace].title)}
          </span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className={cn(
              'size-1.5 rounded-full',
              status === 'connected' ? 'bg-success' : status === 'disconnected' ? 'bg-danger' : 'animate-pulse bg-warning',
            )}
          />
          {status === 'connected' ? t('Live') : status === 'disconnected' ? t('Offline — retrying') : t('Connecting…')}
        </p>
      </div>

      {can('ordersCreate') && (
        <Link to="/orders/new" className="hidden sm:block">
          <Button size="sm" icon={<Plus className="size-4" />}>
            {t('New order')}
          </Button>
        </Link>
      )}
      <LangToggle className="hidden sm:inline-flex" />
      <NotificationBell />
      <UserMenu />
    </header>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) return null
  const initials = user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface" aria-expanded={open} aria-label={t('Account menu')}>
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-fg">{initials}</span>
        <span className="hidden text-left md:block">
          <span className="block text-sm leading-tight font-medium text-ink">{user.fullName}</span>
          <span className="block text-xs text-muted">{user.roles.map((r) => roleLabel(r)).join(', ')}</span>
        </span>
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-40 w-56 rounded-2xl border border-line bg-paper p-1.5 shadow-xl">
          <div className="px-3 py-2 md:hidden">
            <p className="text-sm font-medium text-ink">{user.fullName}</p>
            <p className="text-xs text-muted">{user.email}</p>
            <LangToggle className="mt-2" />
          </div>
          <Link to="/settings?tab=profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-surface">
            <UserRound className="size-4" /> {t('My profile')}
          </Link>
          <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-surface">
            <Settings className="size-4" /> {t('Settings')}
          </Link>
          <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-danger hover:bg-danger/5">
            <LogOut className="size-4" /> {t('Sign out')}
          </button>
        </div>
      )}
    </div>
  )
}

function BottomNav({ onMore, can }: { onMore: () => void; can: (p: Permission) => boolean }) {
  const workspace = useWorkspace()
  const { t } = useI18n()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden" aria-label={t('Quick navigation')}>
      <div className="mx-auto flex max-w-lg">
        {bottomNavByWorkspace[workspace].filter((i) => can(i.permission)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand-ink' : 'text-muted')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex h-7 w-12 items-center justify-center rounded-full', isActive && 'bg-brand text-brand-fg')}>
                  <item.icon className="size-4.5" />
                </span>
                {t(item.label)}
              </>
            )}
          </NavLink>
        ))}
        <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
          <span className="flex h-7 w-12 items-center justify-center">
            <MoreHorizontal className="size-4.5" />
          </span>
          {t('More')}
        </button>
      </div>
    </nav>
  )
}
