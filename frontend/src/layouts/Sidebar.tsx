import { useState } from 'react'
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { useAuth, useWorkspace } from '@/features/auth/AuthContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { sizedImage } from '@/lib/images'
import { workspaces } from '@/lib/permissions'
import { navigationByWorkspace, type NavItem } from './navigation'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
}

/**
 * Navigation sidebar, tinted with the workspace colour (black & gold for admins, emerald for waiters, …).
 * Collapses to an icon rail on desktop; used inside a drawer on mobile.
 */
export function Sidebar({ collapsed, onToggleCollapsed, onNavigate }: SidebarProps) {
  const { can } = useAuth()
  const workspace = useWorkspace()
  const location = useLocation()
  const { t } = useI18n()
  const cover = sizedImage(useRestaurant().restaurant?.coverImageUrl, 600)

  const items = navigationByWorkspace[workspace]
    .map((item) => (item.children ? { ...item, children: item.children.filter((c) => can(c.permission)) } : item))
    .filter((item) => (item.children ? item.children.length > 0 : can(item.permission!)))

  return (
    <div className="flex h-full flex-col bg-sidebar text-paper">
      {/* Logo + workspace over the restaurant photo */}
      <div className="relative isolate shrink-0 overflow-hidden border-b border-paper/10">
        {cover && <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 -z-20 size-full object-cover opacity-70 saturate-[.8]" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sidebar/35 via-sidebar/70 to-sidebar" aria-hidden="true" />

        <div className={cn('flex h-20 items-center', collapsed ? 'justify-center px-2' : 'px-6')}>
          {collapsed ? <LogoMark /> : <Logo size="sm" tone="light" />}
        </div>

        {/* Which workspace am I in? */}
        <div className={cn('pb-4', collapsed ? 'px-3' : 'px-4')}>
          {collapsed ? (
            <span className="mx-auto block h-1 w-8 rounded-full bg-sidebar-accent" title={t(workspaces[workspace].title)} />
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-sidebar/60 px-3 py-2.5 ring-1 ring-paper/15 backdrop-blur">
              <span className="size-2.5 shrink-0 rounded-full bg-sidebar-accent shadow-[0_0_0_4px_rgb(255_255_255/0.08)]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-wide text-sidebar-accent">{t(workspaces[workspace].title)}</span>
                <span className="block truncate text-[11px] tracking-[0.18em] text-paper/60 uppercase">{t('{role} workspace', { role: t(workspaces[workspace].subtitle) })}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label={t('Main navigation')}>
        {items.map((item) => (
          <SidebarItem key={item.label} item={item} collapsed={collapsed} pathname={location.pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-12 shrink-0 items-center justify-center gap-2 border-t border-paper/10 text-sm text-paper/60 hover:text-paper"
          aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : (<><ChevronsLeft className="size-4" /> {t('Collapse')}</>)}
        </button>
      )}
    </div>
  )
}

const linkClass = (active: boolean, collapsed: boolean) =>
  cn(
    'flex h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors',
    collapsed ? 'justify-center px-0' : 'px-3',
    active ? 'bg-sidebar-active text-sidebar-active-fg shadow-sm' : 'text-paper/70 hover:bg-paper/10 hover:text-paper',
  )

function SidebarItem({ item, collapsed, pathname, onNavigate }: { item: NavItem; collapsed: boolean; pathname: string; onNavigate?: () => void }) {
  const Icon = item.icon
  const { t } = useI18n()
  const childActive = !!item.children?.some((c) => pathname === c.to || pathname.startsWith(c.to + '/'))
  const [open, setOpen] = useState(childActive)

  if (!item.children) {
    return (
      <NavLink to={item.to!} end={item.end} onClick={onNavigate} title={collapsed ? t(item.label) : undefined} className={({ isActive }) => linkClass(isActive, collapsed)}>
        <Icon className="size-5 shrink-0" />
        {!collapsed && <span className="truncate">{t(item.label)}</span>}
      </NavLink>
    )
  }

  // Collapsed rail: the group icon links to its first child.
  if (collapsed) {
    return (
      <NavLink to={item.children[0].to} onClick={onNavigate} title={t(item.label)} className={() => linkClass(childActive, true)}>
        <Icon className="size-5 shrink-0" />
      </NavLink>
    )
  }

  const expanded = open || childActive
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          childActive ? 'text-paper' : 'text-paper/70 hover:bg-paper/10 hover:text-paper',
        )}
      >
        <Icon className={cn('size-5 shrink-0', childActive && 'text-sidebar-accent')} />
        <span className="flex-1 truncate text-left">{t(item.label)}</span>
        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="mt-0.5 mb-1 ml-5 space-y-0.5 border-l border-paper/15 pl-3">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center rounded-lg px-3 text-sm transition-colors',
                  isActive ? 'bg-paper/15 font-medium text-sidebar-accent' : 'text-paper/60 hover:bg-paper/10 hover:text-paper',
                )
              }
            >
              {t(child.label)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
