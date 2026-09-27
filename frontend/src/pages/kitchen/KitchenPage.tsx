import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LogOut, Maximize, QrCode, UserRound, Volume2, VolumeX } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useRealtimeEvent, useRealtimeStatus } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ordersApi } from '@/lib/endpoints'
import { formatTime, minutesSince } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { sizedImage } from '@/lib/images'
import { canMoveOrderTo, homePathFor } from '@/lib/permissions'
import { playChime } from '@/lib/sound'
import type { Order, OrderStatus } from '@/types/api'

type Column = 'new' | 'preparing' | 'ready' | 'completed'

const columns: { key: Column; title: string; statuses: OrderStatus[] }[] = [
  { key: 'new', title: 'kds|New', statuses: ['Pending', 'Confirmed'] },
  { key: 'preparing', title: 'kds|Preparing', statuses: ['Preparing'] },
  { key: 'ready', title: 'kds|Ready', statuses: ['Ready'] },
  { key: 'completed', title: 'kds|Completed', statuses: ['Served', 'Completed'] },
]

/** The single big action per ticket — large targets for busy kitchen hands. */
const actionFor: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  Pending: { to: 'Confirmed', label: 'kds|Accept' },
  Confirmed: { to: 'Preparing', label: 'kds|Start' },
  Preparing: { to: 'Ready', label: 'kds|Ready' },
  Ready: { to: 'Served', label: 'kds|Served' },
}

const SOUND_KEY = 'faro.kds.sound'

/** Full-screen Kitchen Display System (separate from the admin layout). */
export function KitchenPage() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const kitchenOnly = !!user && homePathFor(user.roles) === '/kitchen'
  const { restaurant } = useRestaurant()
  const toast = useToast()
  const status = useRealtimeStatus()
  const { data, error, reload, setData } = useAsync((signal) => ordersApi.kitchen(signal))
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== '0'
    } catch {
      return true
    }
  })

  // Tick every 30s for ticket timers; full refresh every 2 min as a safety net.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const refresh = setInterval(reload, 120_000)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
    }
  }, [reload])

  const upsert = (order: Order) =>
    setData((list) => {
      const rest = (list ?? []).filter((o) => o.id !== order.id)
      return order.status === 'Cancelled' ? rest : [...rest, order]
    })

  useRealtimeEvent<Order>('orderCreated', (order) => {
    upsert(order)
    setFlash(order.id)
    setTimeout(() => setFlash((f) => (f === order.id ? null : f)), 6000)
    if (sound) playChime()
    toast.notify(t('NEW ORDER · {table}', { table: order.tableName ?? t('Takeaway') }), order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', '))
  })
  useRealtimeEvent<Order>('orderUpdated', upsert)

  const move = async (order: Order, to: OrderStatus) => {
    setBusy(order.id)
    try {
      upsert(await ordersApi.setStatus(order.id, to))
    } catch (err) {
      toast.error(t('Could not update the order'), getErrorMessage(err))
      reload()
    } finally {
      setBusy(null)
    }
  }

  const grouped = useMemo(() => {
    const byColumn: Record<Column, Order[]> = { new: [], preparing: [], ready: [], completed: [] }
    for (const order of data ?? []) {
      const col = columns.find((c) => c.statuses.includes(order.status))
      if (col) byColumn[col.key].push(order)
    }
    byColumn.completed.sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
    byColumn.completed = byColumn.completed.slice(0, 12)
    return byColumn
  }, [data])

  const toggleSound = () => {
    setSound((s) => {
      try {
        localStorage.setItem(SOUND_KEY, s ? '0' : '1')
      } catch {
        /* ignore */
      }
      if (!s) playChime()
      return !s
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#15110e] text-paper">
      <header className="relative isolate flex h-16 shrink-0 items-center gap-4 overflow-hidden border-b border-paper/10 bg-sidebar px-4 sm:px-6">
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" aria-hidden="true" />
        {restaurant?.coverImageUrl && (
          <img src={sizedImage(restaurant.coverImageUrl, 1400) ?? undefined} alt="" aria-hidden="true" className="absolute inset-0 -z-20 size-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-sidebar from-40% via-sidebar/80 to-sidebar/30" aria-hidden="true" />
        {kitchenOnly ? null : (
          <Link to={user ? homePathFor(user.roles) : '/'} className="rounded-xl p-2 text-paper/60 hover:bg-paper/10 hover:text-paper" aria-label={t('Back to portal')}>
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <Logo size="sm" tone="light" className="hidden sm:inline-flex" />
        <div className="ml-2 hidden h-8 w-px bg-paper/15 sm:block" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase"><span className="text-sidebar-accent">{t('Kitchen')}</span> · {t('Kitchen display')}</p>
          <p className="flex items-center gap-1.5 text-xs text-paper/50">
            <span className={cn('size-1.5 rounded-full', status === 'connected' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400')} />
            {status === 'connected' ? t('Live') : t('Reconnecting…')} · {user?.fullName}
          </p>
        </div>
        <Clock />
        <button type="button" onClick={toggleSound} className="rounded-xl p-2.5 text-paper/70 hover:bg-paper/10 hover:text-paper" aria-label={sound ? t('Mute new-order sound') : t('Enable new-order sound')}>
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
        <button type="button" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)} className="hidden rounded-xl p-2.5 text-paper/70 hover:bg-paper/10 hover:text-paper sm:block" aria-label={t('Full screen')}>
          <Maximize className="size-5" />
        </button>
        {kitchenOnly && (
          <>
            <Link to="/settings?tab=profile" className="hidden rounded-xl p-2.5 text-paper/70 hover:bg-paper/10 hover:text-paper sm:block" aria-label={t('My profile')}>
              <UserRound className="size-5" />
            </Link>
            <button type="button" onClick={logout} className="rounded-xl p-2.5 text-paper/70 hover:bg-paper/10 hover:text-paper" aria-label={t('Sign out')}>
              <LogOut className="size-5" />
            </button>
          </>
        )}
      </header>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} className="text-paper" />
      ) : !data ? (
        <div className="flex flex-1 items-center justify-center"><Spinner className="size-8 text-paper/60" /></div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-x-auto p-3 md:grid-cols-2 xl:grid-cols-4 sm:gap-4 sm:p-4">
          {columns.map((col) => (
            <section key={col.key} className="flex min-h-[240px] min-w-0 flex-col rounded-2xl bg-paper/[0.04]" aria-label={t(col.title)}>
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-bold tracking-[0.25em] uppercase">{t(col.title)}</h2>
                <span className="rounded-full bg-paper/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums">{grouped[col.key].length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3 xl:max-h-[calc(100dvh-8.5rem)]">
                {grouped[col.key].length === 0 && <p className="py-10 text-center text-sm text-paper/30">{t('No orders')}</p>}
                {grouped[col.key].map((order) => (
                  <Ticket
                    key={order.id}
                    order={order}
                    now={now}
                    highlight={flash === order.id}
                    busy={busy === order.id}
                    prepMinutes={restaurant?.settings.defaultPreparationMinutes ?? 15}
                    canAct={(to) => canMoveOrderTo(user?.roles, to)}
                    onAction={(to) => move(order, to)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Ticket({
  order,
  now,
  highlight,
  busy,
  prepMinutes,
  canAct,
  onAction,
}: {
  order: Order
  now: number
  highlight: boolean
  busy: boolean
  prepMinutes: number
  canAct: (to: OrderStatus) => boolean
  onAction: (to: OrderStatus) => void
}) {
  const { t } = useI18n()
  const next = actionFor[order.status]
  // Only steps that are the kitchen's job; serving is the waiter's.
  const action = next && canAct(next.to) ? next : undefined
  const elapsed = minutesSince(order.createdAt, now)
  const done = order.status === 'Served' || order.status === 'Completed'
  // Only tickets still being cooked can be late; ready plates are the waiter's.
  const late = !done && order.status !== 'Ready' && elapsed >= prepMinutes

  return (
    <article
      className={cn(
        'rounded-2xl border bg-paper text-ink transition-shadow',
        highlight ? 'border-paper shadow-[0_0_0_4px_rgba(255,255,255,0.35)]' : late ? 'border-amber-400' : 'border-transparent',
        done && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 pt-4 pb-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t('Order #{number}', { number: order.number })}</p>
          <p className="font-display text-2xl leading-tight font-semibold">{order.tableName ?? t('Takeaway')}</p>
        </div>
        <div className="text-right">
          <p className={cn('text-lg font-bold tabular-nums', late && 'text-amber-600')}>{elapsed}′</p>
          <p className="text-xs text-muted">{formatTime(order.createdAt)}</p>
        </div>
      </div>

      <ul className="space-y-1.5 px-4 py-3">
        {order.items.map((i) => (
          <li key={i.id}>
            <p className="text-base font-semibold">
              <span className="mr-2 inline-block min-w-7 tabular-nums">{i.quantity}×</span>
              {i.productName}
            </p>
            {i.notes && <p className="ml-9 text-sm font-medium text-amber-700">⚠ {i.notes}</p>}
          </li>
        ))}
      </ul>
      {order.notes && <p className="mx-4 mb-3 rounded-lg bg-surface px-3 py-2 text-sm">📝 {order.notes}</p>}

      <div className="flex items-center gap-2 px-4 pb-4">
        {order.source === 'QrMenu' && (
          <span className="inline-flex items-center gap-1 text-xs text-muted" title={t('Ordered from QR menu')}><QrCode className="size-3.5" /> QR</span>
        )}
        {order.status === 'Pending' && <span className="text-xs font-semibold text-amber-700">{t('Awaiting acceptance')}</span>}
        {order.status === 'Ready' && !action && (
          <span className="ml-auto rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{t('At the pass · waiting for a waiter')}</span>
        )}
        {action && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(action.to)}
            className="ml-auto flex h-14 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-bold tracking-[0.2em] text-brand-fg uppercase transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {busy ? <Spinner className="size-5" /> : t(action.label)}
          </button>
        )}
      </div>
    </article>
  )
}

function Clock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  return <p className="hidden text-2xl font-semibold tabular-nums sm:block">{time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
}
