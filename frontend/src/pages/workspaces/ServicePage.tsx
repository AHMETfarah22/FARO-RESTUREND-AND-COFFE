import { useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, CalendarDays, ChefHat, ConciergeBell, Plus, QrCode, Sparkles, Table2, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { greeting, heroPrimary, heroSecondary, todayLabel } from '@/components/brand/hero'
import { WorkspaceHero } from '@/components/brand/WorkspaceHero'
import { OrderStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { openStatuses } from '@/features/orders/workflow'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ordersApi, reservationsApi, tablesApi } from '@/lib/endpoints'
import { formatTimeOnly, minutesSince, toIsoDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { playChime } from '@/lib/sound'
import type { DiningTable, Order, OrderStatus, PagedResult } from '@/types/api'

/**
 * Garson — the waiter's home: plates waiting at the pass, new QR orders to accept,
 * the floor plan and today's reservations. Everything updates live.
 */
export function ServicePage() {
  const { user, can } = useAuth()
  const { t } = useI18n()
  const { restaurant } = useRestaurant()
  const toast = useToast()
  const navigate = useNavigate()
  const today = toIsoDate(new Date())

  const orders = useAsync((signal) => ordersApi.list({ status: openStatuses, pageSize: 100 }, signal))
  const tables = useAsync((signal) => tablesApi.list(signal))
  const reservations = useAsync((signal) => reservationsApi.list({ from: today, to: today }, signal), [today])
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Remember each order's last status so we can announce "ready to serve" exactly once.
  const lastStatus = useRef(new Map<string, OrderStatus>())
  useEffect(() => {
    for (const o of orders.data?.items ?? []) lastStatus.current.set(o.id, o.status)
  }, [orders.data])

  const upsert = (order: Order) =>
    orders.setData((page) => {
      const items = (page?.items ?? []).filter((o) => o.id !== order.id)
      if (openStatuses.includes(order.status)) items.push(order)
      return { ...(page ?? emptyPage), items }
    })

  useRealtimeEvent<Order>('orderCreated', (order) => {
    upsert(order)
    tables.reload()
  })
  useRealtimeEvent<Order>('orderUpdated', (order) => {
    const before = lastStatus.current.get(order.id)
    if (order.status === 'Ready' && before !== 'Ready') {
      if (restaurant?.settings.newOrderSound !== false) playChime()
      toast.notify(t('{table} · ready to serve', { table: order.tableName ?? t('Takeaway') }), order.items.map((i) => `${i.quantity}× ${i.productName}`).join(', '))
    }
    upsert(order)
    tables.reload()
  })
  useRealtimeEvent('tablesChanged', tables.reload)

  const list = useMemo(() => orders.data?.items ?? [], [orders.data])
  const byOldest = (a: Order, b: Order) => new Date(a.updatedAt ?? a.createdAt).getTime() - new Date(b.updatedAt ?? b.createdAt).getTime()
  const ready = list.filter((o) => o.status === 'Ready').sort(byOldest)
  const toAccept = list.filter((o) => o.status === 'Pending').sort(byOldest)
  const inKitchen = list.filter((o) => o.status === 'Confirmed' || o.status === 'Preparing').sort(byOldest)
  const served = list.filter((o) => o.status === 'Served' && o.paymentStatus !== 'Paid').sort(byOldest)
  const loaded = !!orders.data

  const floor = (tables.data ?? []).filter((tb) => tb.status !== 'Disabled')
  const occupied = floor.filter((tb) => tb.status === 'Occupied').length
  const upcoming = (reservations.data ?? [])
    .filter((r) => r.status === 'Pending' || r.status === 'Confirmed')
    .sort((a, b) => a.time.localeCompare(b.time))

  const move = async (order: Order, to: OrderStatus, done: string) => {
    setBusy(order.id)
    try {
      upsert(await ordersApi.setStatus(order.id, to))
      toast.success(done, `${order.tableName ?? t('Takeaway')} · #${order.number}`)
    } catch (err) {
      toast.error(t('Could not update the order'), getErrorMessage(err))
      orders.reload()
    } finally {
      setBusy(null)
    }
  }

  const markClean = async (table: DiningTable) => {
    setBusy(table.id)
    try {
      const updated = await tablesApi.setStatus(table.id, 'Available')
      tables.setData((list) => (list ?? []).map((tb) => (tb.id === updated.id ? updated : tb)))
    } catch (err) {
      toast.error(t('Could not update the table'), getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (orders.error && !orders.data) return <ErrorState message={orders.error} onRetry={orders.reload} />

  return (
    <>
      <WorkspaceHero
        image={restaurant?.coverImageUrl}
        eyebrow={`${t('Service')} · ${todayLabel()}`}
        title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? ''}`}
        description={t("Your floor at a glance: plates waiting at the pass, new QR orders and today's guests.")}
        stats={[
          { label: t('Ready to serve'), value: loaded ? ready.length : '–', highlight: ready.length > 0 },
          { label: t('In the kitchen'), value: loaded ? inKitchen.length + toAccept.length : '–' },
          { label: t('Tables busy'), value: tables.data ? `${occupied}/${floor.length}` : '–' },
          { label: t('Reservations'), value: reservations.data ? upcoming.length : '–' },
        ]}
        actions={
          <>
            {can('ordersCreate') && (
              <Link to="/orders/new" className={heroPrimary}>
                <Plus className="size-4" /> {t('New order')}
              </Link>
            )}
            <Link to="/tables" className={heroSecondary}>
              <Table2 className="size-4" /> {t('Tables')}
            </Link>
            <Link to="/reservations" className={heroSecondary}>
              <CalendarDays className="size-4" /> {t('Reservations')}
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* The pass: the most important list for a waiter */}
          <Card className={cn(ready.length > 0 && 'ring-2 ring-brand/40')}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <span className={cn('flex size-8 items-center justify-center rounded-lg', ready.length ? 'bg-brand text-brand-fg' : 'bg-surface text-muted')}>
                    <BellRing className={cn('size-4', ready.length > 0 && 'animate-pulse')} />
                  </span>
                  {t('Ready to serve')}
                </span>
              }
              description={t('Plates finished by the kitchen, oldest first.')}
            />
            {!orders.data ? (
              <div className="grid gap-3 p-5 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
            ) : ready.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted">
                <Sparkles className="size-4" /> {t('Nothing waiting at the pass.')}
              </p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                {ready.map((o) => (
                  <article key={o.id} className="flex flex-col rounded-2xl border border-brand/25 bg-brand-soft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-3xl leading-none font-semibold text-ink">{o.tableName ?? t('Takeaway')}</p>
                        <p className="mt-1.5 text-xs text-muted">
                          #{o.number} · {t('ready {n} min ago', { n: minutesSince(o.updatedAt ?? o.createdAt, now) })}
                        </p>
                      </div>
                      {o.source === 'QrMenu' && <QrCode className="size-4 text-muted" aria-label={t('QR order')} />}
                    </div>
                    <ul className="mt-3 flex-1 space-y-1 text-sm">
                      {o.items.map((i) => (
                        <li key={i.id}>
                          <span className="font-semibold tabular-nums">{i.quantity}×</span> {i.productName}
                          {i.notes && <span className="block pl-6 text-xs text-warning">{i.notes}</span>}
                        </li>
                      ))}
                    </ul>
                    <Button size="lg" className="mt-4 w-full" icon={<ConciergeBell className="size-5" />} loading={busy === o.id} onClick={() => move(o, 'Served', t('Marked as served'))}>
                      {t('Mark served')}
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </Card>

          {toAccept.length > 0 && (
            <Card>
              <CardHeader title={t('New orders to accept')} description={t('Placed from a QR code or waiting for confirmation.')} />
              <ul className="divide-y divide-line">
                {toAccept.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium text-ink">
                        {o.tableName ?? t('Takeaway')} <span className="text-sm font-normal text-muted">#{o.number}</span>
                        {o.source === 'QrMenu' && <QrCode className="size-3.5 text-muted" />}
                      </p>
                      <p className="truncate text-xs text-muted">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</p>
                    </div>
                    <span className="text-xs text-muted">{t('{n} min', { n: minutesSince(o.createdAt, now) })}</span>
                    <Link to={`/orders/${o.id}`}><Button size="sm" variant="secondary">{t('Open')}</Button></Link>
                    <Button size="sm" loading={busy === o.id} onClick={() => move(o, 'Confirmed', t('Order accepted'))}>{t('Accept')}</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Floor plan */}
          <Card>
            <CardHeader
              title={t('Floor')}
              description={t('Tap a table to take its order.')}
              action={<Link to="/tables" className="text-sm font-medium text-brand-ink underline-offset-4 hover:underline">{t('All tables')}</Link>}
            />
            {tables.error && !tables.data ? (
              <ErrorState message={tables.error} onRetry={tables.reload} className="py-10" />
            ) : !tables.data ? (
              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
                {floor.map((tb) => (
                  <FloorTile
                    key={tb.id}
                    table={tb}
                    busy={busy === tb.id}
                    onOpen={can('ordersCreate') ? () => navigate(`/orders/new?tableId=${tb.id}`) : undefined}
                    onClean={() => markClean(tb)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ChefHat className="size-4" /> {t('In the kitchen')}</span>} description={t('Accepted orders being cooked.')} />
            {inKitchen.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted">{t('The kitchen is clear.')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {inKitchen.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{o.tableName ?? t('Takeaway')} · #{o.number}</span>
                        <span className="block truncate text-xs text-muted">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</span>
                      </span>
                      <span className="text-xs text-muted tabular-nums">{minutesSince(o.createdAt, now)}′</span>
                      <OrderStatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><CalendarDays className="size-4" /> {t("Today's reservations")}</span>}
              action={<Link to="/reservations" className="text-sm font-medium text-brand-ink underline-offset-4 hover:underline">{t('Calendar')}</Link>}
            />
            {reservations.error && !reservations.data ? (
              <ErrorState message={reservations.error} onRetry={reservations.reload} className="py-8" />
            ) : !reservations.data ? (
              <div className="p-5"><Skeleton className="h-20" /></div>
            ) : upcoming.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted">{t('No more reservations today.')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="w-14 shrink-0 rounded-lg bg-brand-soft py-1.5 text-center text-sm font-semibold text-brand-ink tabular-nums">{formatTimeOnly(r.time)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{r.customerName}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <Users className="size-3" /> {r.partySize} · {r.tableName ?? t('No table yet')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {served.length > 0 && (
            <Card>
              <CardHeader title={t('Served · waiting for the bill')} description={t('The table is freed automatically once the cashier takes payment.')} />
              <ul className="divide-y divide-line">
                {served.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="font-medium text-ink">{o.tableName ?? t('Takeaway')} · #{o.number}</span>
                    <span className="text-xs text-muted">{t('{n} min', { n: minutesSince(o.updatedAt ?? o.createdAt, now) })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

const emptyPage: PagedResult<Order> = { items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 1 }

const tileStyles: Record<DiningTable['status'], { box: string; dot: string; label: string }> = {
  Available: { box: 'bg-paper border-line hover:border-brand/50', dot: 'bg-success', label: 'table|Available' },
  Occupied: { box: 'bg-brand-soft border-brand/30 hover:border-brand/60', dot: 'bg-brand', label: 'Seated' },
  Reserved: { box: 'bg-warning/5 border-warning/30 hover:border-warning/60', dot: 'bg-warning', label: 'table|Reserved' },
  Cleaning: { box: 'bg-surface border-line', dot: 'bg-muted', label: 'table|Cleaning' },
  Disabled: { box: 'bg-surface border-line opacity-50', dot: 'bg-muted', label: 'table|Disabled' },
}

function FloorTile({ table, busy, onOpen, onClean }: { table: DiningTable; busy: boolean; onOpen?: () => void; onClean: () => void }) {
  const { money } = useRestaurant()
  const { t } = useI18n()
  const style = tileStyles[table.status]
  const cleaning = table.status === 'Cleaning'

  return (
    <div className={cn('relative flex min-h-24 flex-col rounded-2xl border p-3.5 transition-colors', style.box)}>
      <button
        type="button"
        disabled={!onOpen || cleaning}
        onClick={onOpen}
        className="absolute inset-0 rounded-2xl disabled:cursor-default"
        aria-label={t('New order for {table}', { table: table.name })}
      />
      <div className="pointer-events-none flex items-center justify-between">
        <p className="font-semibold text-ink">{table.name}</p>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          <span className={cn('size-2 rounded-full', style.dot)} /> {t(style.label)}
        </span>
      </div>
      <p className="pointer-events-none mt-1 flex items-center gap-1 text-xs text-muted">
        <Users className="size-3" /> {t('{n} seats', { n: table.capacity })}
      </p>
      {table.status === 'Occupied' && table.openAmount > 0 && (
        <p className="pointer-events-none mt-auto pt-2 text-sm font-semibold text-brand-ink tabular-nums">{money(table.openAmount)}</p>
      )}
      {cleaning && (
        <button
          type="button"
          onClick={onClean}
          disabled={busy}
          className="relative mt-auto self-start rounded-lg bg-paper px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line hover:ring-brand/50 disabled:opacity-60"
        >
          {t('Cleaned')} ✓
        </button>
      )}
    </div>
  )
}
