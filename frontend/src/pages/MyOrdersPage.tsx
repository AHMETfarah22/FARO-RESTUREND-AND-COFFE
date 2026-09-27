import { ChevronRight, LogOut, Receipt, Smartphone } from 'lucide-react'
import { Link } from 'react-router'
import { CoverHero } from '@/components/brand/CoverHero'
import { Logo } from '@/components/brand/Logo'
import { OrderStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthContext'
import { readCachedCover } from '@/features/menu/customerPush'
import { useTrackedOrders } from '@/features/menu/useCart'
import { useAsync } from '@/hooks/useAsync'
import { restaurantApi, ordersApi } from '@/lib/endpoints'
import { formatDateTime, formatMoney } from '@/lib/format'

/** Customer account page (light blue & white): their own order history. */
export function MyOrdersPage() {
  const { user, logout } = useAuth()
  const { data, error, loading, reload } = useAsync((signal) => ordersApi.mine(signal))
  const info = useAsync((signal) => restaurantApi.publicInfo(signal))
  const tracked = useTrackedOrders()

  const spent = (data ?? []).filter((o) => o.status !== 'Cancelled').reduce((sum, o) => sum + o.total, 0)

  return (
    <div className="min-h-dvh bg-surface pb-12">
      <CoverHero image={info.data?.coverImageUrl ?? readCachedCover()} tone="sky" width={1200} className="rounded-b-[2rem] px-5 pt-6 pb-14">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Logo size="sm" tone="light" />
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full border border-paper/50 bg-paper/15 px-3.5 py-1.5 text-xs font-semibold text-paper backdrop-blur hover:bg-paper/25"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
        <div className="mx-auto mt-8 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-paper/80 uppercase">Müşteri · My account</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">Hello, {user?.fullName.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-paper/85">Your orders at {info.data?.name ?? 'FARO RESTURENT AND COFFE'}. To order, scan the QR code on your masa.</p>
        </div>
      </CoverHero>

      <main className="mx-auto -mt-8 max-w-2xl space-y-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-paper p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Orders</p>
            <p className="mt-1 text-2xl font-semibold text-brand-ink tabular-nums">{data ? data.length : '–'}</p>
          </div>
          <div className="rounded-2xl bg-paper p-4 shadow-[var(--shadow-soft)] ring-1 ring-line">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">Total spent</p>
            <p className="mt-1 text-2xl font-semibold text-brand-ink tabular-nums">{data ? formatMoney(spent) : '–'}</p>
          </div>
        </div>

        {tracked.ids.length > 0 && (
          <Link to="/menu/orders" className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4 ring-1 ring-brand/20">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-brand-fg"><Smartphone className="size-5" /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">Orders from this phone</span>
              <span className="block text-xs text-muted">Live status of the orders you placed with a QR code</span>
            </span>
            <ChevronRight className="size-5 text-brand-ink" />
          </Link>
        )}

        <Card>
          <AsyncBlock
            data={data}
            loading={loading}
            error={error}
            onRetry={reload}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState icon={<Receipt className="size-6" />} title="No orders yet" description="Orders placed with your phone number or email will show up here." />}
          >
            {(orders) => (
              <ul className="divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-ink">#{o.number} · {o.tableName ?? 'Takeaway'}</p>
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</p>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-muted">{formatDateTime(o.createdAt)}</span>
                      <span className="font-semibold text-brand-ink tabular-nums">{formatMoney(o.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </AsyncBlock>
        </Card>
        <Button variant="secondary" className="border-brand text-brand-ink" onClick={reload}>Refresh</Button>
      </main>
    </div>
  )
}
