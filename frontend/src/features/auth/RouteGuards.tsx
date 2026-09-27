import type { ReactNode } from 'react'
import { ShieldX } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { LogoMark } from '@/components/brand/Logo'
import { Spinner } from '@/components/ui/Spinner'
import { translate as t } from '@/lib/i18n'
import { homePathFor, type Permission } from '@/lib/permissions'
import { useAuth } from './AuthContext'

function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-900">
      <LogoMark />
      <Spinner className="text-paper/60" />
    </div>
  )
}

/** Requires a signed-in user; remembers where they were going. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { user, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children ?? <Outlet />}</>
}

/** Shows a friendly 403 page when the role lacks the permission (the API enforces it too). */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth()
  return can(permission) ? <>{children}</> : <Forbidden />
}

/** Login/register pages: signed-in users go straight to their home page. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <FullScreenLoader />
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : homePathFor(user.roles)} replace />
  }
  return <>{children}</>
}

export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? homePathFor(user.roles) : '/login'} replace />
}

function Forbidden() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-ink">
        <ShieldX className="size-7" />
      </span>
      <h1 className="mt-5 font-display text-3xl font-semibold text-ink">{t('No access')}</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">{t('Your role does not have permission to open this page. Ask a manager if you need access.')}</p>
      <Link to={user ? homePathFor(user.roles) : '/login'} className="mt-6 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-brand-fg hover:bg-brand-hover">
        {t('Go to my home page')}
      </Link>
    </div>
  )
}
