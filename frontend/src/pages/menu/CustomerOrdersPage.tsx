import { useEffect, useMemo } from 'react'
import { ArrowLeft, Plus, Receipt, UtensilsCrossed } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { CoverHero } from '@/components/brand/CoverHero'
import { Logo } from '@/components/brand/Logo'
import { Spinner } from '@/components/ui/Spinner'
import { addCustomerManifest, readCachedCover } from '@/features/menu/customerPush'
import { applyCustomerLang, useCustomerText } from '@/features/menu/customerText'
import { LangSwitch, NotifyCard, OrderProgressCard, ReadyOverlay } from '@/features/menu/CustomerOrderViews'
import { useTrackedOrders } from '@/features/menu/useCart'
import { useCustomerOrders } from '@/features/menu/useCustomerOrders'
import { useDevice } from '@/features/menu/useDevice'
import { useWorkspaceTheme } from '@/features/theme/useWorkspaceTheme'
import { cn } from '@/lib/cn'
import { formatMoney, toIsoDate } from '@/lib/format'

/**
 * Customer "My orders" (/menu/orders) — every order placed from this phone via a QR code, with live status.
 * No login: the list lives in this browser. One column on phones, a two-column board on computers.
 */
export function CustomerOrdersPage() {
  const [params] = useSearchParams()
  const device = useDevice()
  const { t } = useCustomerText()
  const tracked = useTrackedOrders()
  const { orders, activeCount, readyAlert, dismissReady } = useCustomerOrders(tracked.ids, tracked.forget)
  useWorkspaceTheme('customer')

  const backTable = params.get('table') ?? tracked.orders[0]?.tableId ?? null
  const menuHref = backTable ? `/menu/table/${backTable}` : null
  const today = toIsoDate(new Date())
  const desktop = device === 'desktop'
  const activeIds = useMemo(
    () => tracked.ids.filter((id) => orders[id] && !['Served', 'Completed', 'Cancelled'].includes(orders[id].status)),
    [tracked.ids, orders],
  )

  useEffect(() => {
    addCustomerManifest()
    applyCustomerLang()
  }, [])
  useEffect(() => {
    document.title = activeCount ? `(${activeCount}) ${t.myOrders} · FARO RESTURENT AND COFFE` : `${t.myOrders} · FARO RESTURENT AND COFFE`
  }, [activeCount, t])

  return (
    <div className={cn('min-h-dvh bg-surface', desktop ? 'pb-16' : 'pb-32')}>
      <CoverHero image={readCachedCover()} tone="sky" className={cn('rounded-b-[2rem] px-4 pt-3 text-center sm:px-6 sm:pt-5', desktop ? 'pb-20' : 'pb-14')}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          {menuHref ? (
            <Link to={menuHref} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-paper px-4 text-sm font-semibold text-brand-ink shadow-md">
              <ArrowLeft className="size-4" /> {t.menu}
            </Link>
          ) : (
            <span />
          )}
          <LangSwitch />
        </div>
        <Logo size="sm" tone="light" align="center" className="mt-6" />
        <h1 className="mt-5 font-display text-4xl font-semibold sm:text-5xl">{t.myOrders}</h1>
        <p className="mx-auto mt-2 max-w-md text-base text-paper/90">{activeCount ? t.liveSubtitle(activeCount) : t.fromThisPhone}</p>
      </CoverHero>

      <main className={cn('relative mx-auto -mt-8 space-y-4 px-4', desktop ? 'max-w-5xl' : 'max-w-2xl')}>
        <NotifyCard orderIds={activeIds} />

        {tracked.ids.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-paper px-6 py-14 text-center shadow-[var(--shadow-soft)] ring-1 ring-line">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
              <Receipt className="size-7" />
            </span>
            <p className="mt-4 text-xl font-semibold text-ink">{t.noOrdersYet}</p>
            <p className="mt-1 max-w-sm text-base text-muted">{t.scanHint}</p>
            {menuHref && (
              <Link to={menuHref} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-brand-fg shadow-md shadow-brand/25">
                <UtensilsCrossed className="size-5" /> {t.openMenu}
              </Link>
            )}
          </div>
        ) : (
          <div className={cn('grid gap-4', desktop && tracked.ids.length > 1 && 'grid-cols-2 items-start')}>
            {tracked.orders.map((o) => {
              const order = orders[o.id]
              if (!order) {
                return (
                  <div key={o.id} className="flex justify-center rounded-3xl bg-paper py-12 ring-1 ring-line">
                    <Spinner className="text-brand" />
                  </div>
                )
              }
              return (
                <OrderProgressCard
                  key={o.id}
                  order={order}
                  money={(v) => formatMoney(v, order.currency)}
                  placedToday={order.createdAt.startsWith(today) || toIsoDate(new Date(order.createdAt)) === today}
                />
              )
            })}
          </div>
        )}

        {desktop && menuHref && tracked.ids.length > 0 && (
          <Link to={menuHref} className="mx-auto flex h-14 max-w-sm items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-brand-fg shadow-lg shadow-brand/25">
            <Plus className="size-5" /> {t.orderMore}
          </Link>
        )}
      </main>

      {/* Phone & tablet: "order more" is always one tap away at the bottom */}
      {!desktop && menuHref && tracked.ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-surface via-surface/85 to-transparent px-3 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link to={menuHref} className="mx-auto flex h-16 max-w-xl items-center justify-center gap-2 rounded-2xl bg-brand text-base font-semibold text-brand-fg shadow-2xl shadow-brand/40">
            <Plus className="size-5" /> {t.orderMore}
          </Link>
        </div>
      )}

      <ReadyOverlay order={readyAlert} onClose={dismissReady} />
    </div>
  )
}
