import { AlertTriangle, CalendarDays, CheckCircle2, ChefHat, ClipboardList, Clock, ConciergeBell, Package, Plus, Receipt, Table2, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { greeting, heroPrimary, heroSecondary, todayLabel } from '@/components/brand/hero'
import { WorkspaceHero } from '@/components/brand/WorkspaceHero'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { ColumnChart, RankedBars, TrendChart } from '@/components/charts/Charts'
import { OrderStatusBadge } from '@/components/StatusBadge'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/Layout'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useAuth, useWorkspace } from '@/features/auth/AuthContext'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useAsync } from '@/hooks/useAsync'
import { productsApi, reportsApi } from '@/lib/endpoints'
import { ProductImage } from '@/components/ProductImage'
import { useMemo } from 'react'
import { formatMoney, formatNumber, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { workspaces } from '@/lib/permissions'

export function DashboardPage() {
  const { user, can } = useAuth()
  const workspace = useWorkspace()
  const { t } = useI18n()
  const { restaurant } = useRestaurant()
  const { data, error, loading, reload } = useAsync((signal) => reportsApi.dashboard(signal))
  const products = useAsync((signal) => productsApi.list({}, signal))
  const photos = useMemo(() => new Map(products.data?.map((p) => [p.name, p.imageUrl]) ?? []), [products.data])

  // Keep the numbers live as orders arrive or change.
  useRealtimeEvent('orderCreated', reload)
  useRealtimeEvent('orderUpdated', reload)

  if (error && !data) return <ErrorState message={error} onRetry={reload} />

  const money = (v: number, compact = false) => formatMoney(v, data?.currency ?? 'TRY', { compact })

  return (
    <>
      <WorkspaceHero
        image={restaurant?.coverImageUrl}
        eyebrow={`${t(workspaces[workspace].title)} · ${todayLabel()}`}
        title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? ''}`}
        description={t("Here is what's happening at {name} today.", { name: restaurant?.name ?? t('your restaurant') })}
        actions={
          <>
            {can('ordersCreate') && (
              <Link to="/orders/new" className={heroPrimary}>
                <Plus className="size-4" /> {t('New order')}
              </Link>
            )}
            {can('serviceBoard') && (
              <Link to="/service" className={heroSecondary}>
                <ConciergeBell className="size-4" /> {t('Service')}
              </Link>
            )}
            {can('cashDesk') && (
              <Link to="/cash-desk" className={heroSecondary}>
                <Wallet className="size-4" /> {t('Cash desk')}
              </Link>
            )}
            {can('kitchen') && (
              <Link to="/kitchen" className={heroSecondary}>
                <ChefHat className="size-4" /> {t('Kitchen')}
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {!data || loading && !data ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36" />)
        ) : (
          <>
            <StatCard label={t("Today's sales")} value={money(data.todaySales.value, true)} change={data.todaySales.changePercent} hint={t('vs yesterday')} icon={<Wallet className="size-4" />} to="/reports" />
            <StatCard label={t("Today's orders")} value={formatNumber(data.todayOrders.value)} change={data.todayOrders.changePercent} hint={t('vs yesterday')} icon={<Receipt className="size-4" />} to="/orders" />
            <StatCard label={t('Pending orders')} value={data.pendingOrders} hint={t('in progress now')} icon={<Clock className="size-4" />} to="/orders/pending" />
            <StatCard label={t('Completed orders')} value={data.completedOrders} hint={t('today')} icon={<CheckCircle2 className="size-4" />} to="/orders/completed" />
            <StatCard label={t('Reservations')} value={data.todayReservations} hint={t('today')} icon={<CalendarDays className="size-4" />} to="/reservations" />
            <StatCard label={t('Free tables')} value={`${data.availableTables}/${data.totalTables}`} hint={t('ready to seat')} icon={<Table2 className="size-4" />} to="/tables" />
            <StatCard label={t('Occupied tables')} value={data.occupiedTables} hint={t('with guests')} icon={<ClipboardList className="size-4" />} to="/tables" />
            <StatCard
              label={t('Low stock')}
              value={data.lowStockCount}
              hint={data.lowStockCount ? t('items need reorder') : t('all good')}
              icon={<Package className="size-4" />}
              to="/inventory"
              className={data.lowStockCount ? 'border-warning/40' : undefined}
            />
          </>
        )}
      </div>

      {data && (
        <>
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={t('Daily revenue')} description={t('Paid orders · last 7 days')} />
              <div className="p-4 sm:p-6">
                <TrendChart data={data.last7Days} xKey="label" yKey="revenue" label={t('Revenue')} format={(v) => money(v)} tickFormat={(v) => money(v, true)} />
              </div>
            </Card>
            <Card>
              <CardHeader title={t('Orders')} description={t('Paid orders per day')} />
              <div className="p-4 sm:p-6">
                <ColumnChart data={data.last7Days} xKey="label" yKey="orders" label={t('Orders')} format={(v) => formatNumber(v)} />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title={t('Popular products')} description={t('Units sold · last 30 days')} />
              <div className="p-6">
                <RankedBars
                  rows={data.popularProducts.map((p) => ({
                    label: (
                      <span className="inline-flex items-center gap-2.5 align-middle">
                        <ProductImage src={photos.get(p.productName) ?? null} name={p.productName} width={64} className="size-8 shrink-0 rounded-lg text-[10px]" />
                        {p.productName}
                      </span>
                    ),
                    sublabel: p.categoryName,
                    value: p.quantity,
                    display: t('{n} sold', { n: p.quantity }),
                  }))}
                />
              </div>
            </Card>
            <Card>
              <CardHeader title={t('Category sales')} description={t('Revenue · last 30 days')} />
              <div className="p-6">
                <RankedBars rows={data.categorySales.map((c) => ({ label: c.categoryName, value: c.revenue, display: money(c.revenue, true) }))} />
              </div>
            </Card>
            <Card className="lg:col-span-2 xl:col-span-1">
              <CardHeader
                title={t('Low stock')}
                description={t('Items at or below their minimum')}
                action={<Link to="/inventory" className="text-sm font-medium text-ink underline-offset-4 hover:underline">{t('Inventory')}</Link>}
              />
              {data.lowStockItems.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted">{t('All stock levels are healthy.')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.lowStockItems.map((item) => (
                    <li key={item.name} className="flex items-center gap-3 px-6 py-3.5">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                        <AlertTriangle className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                        <p className="text-xs text-muted">
                          {t('Remaining {qty} {unit} · Min {min} {unit}', { qty: formatNumber(item.quantity, 2), min: formatNumber(item.minimumQuantity, 2), unit: item.unit })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader
              title={t('Recent orders')}
              action={<Link to="/orders" className="text-sm font-medium text-ink underline-offset-4 hover:underline">{t('View all')}</Link>}
            />
            <ul className="divide-y divide-line">
              {data.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface/60">
                    <span className="w-16 shrink-0 font-semibold text-ink tabular-nums">#{o.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{o.tableName ?? t('Takeaway')}{o.customerName ? ` · ${o.customerName}` : ''}</span>
                      <span className="block truncate text-xs text-muted">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</span>
                    </span>
                    <span className="hidden text-xs text-muted sm:block">{timeAgo(o.createdAt)}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">{money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  )
}
