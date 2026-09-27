import { useMemo, useState } from 'react'
import { Banknote, CheckCircle2, CreditCard, FlaskConical, Globe, History, Lock, ReceiptText, Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { greeting, heroPrimary, heroSecondary, todayLabel } from '@/components/brand/hero'
import { WorkspaceHero } from '@/components/brand/WorkspaceHero'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Checkbox, Field, Input } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { openStatuses } from '@/features/orders/workflow'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ordersApi, paymentsApi } from '@/lib/endpoints'
import { formatTime, toIsoDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { paymentMethodLabel, paymentStatusLabel } from '@/lib/labels'
import type { Order, PaymentMethod } from '@/types/api'

const methodIcons: Record<PaymentMethod, typeof Banknote> = { Cash: Banknote, Card: CreditCard, Online: Globe, Test: FlaskConical }

/** Served first (the guest is asking for the bill), then the rest by age. */
const billOrder: Record<string, number> = { Served: 0, Ready: 1, Preparing: 2, Confirmed: 3, Pending: 4 }

const outstandingOf = (o: Order) => Math.max(0, Math.round((o.total - o.paidAmount) * 100) / 100)

/**
 * Kasa — the cashier's home: open bills to collect, paid orders to close,
 * and today's takings by payment method.
 */
export function CashDeskPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { restaurant, money } = useRestaurant()
  const toast = useToast()
  const today = toIsoDate(new Date())

  const orders = useAsync((signal) => ordersApi.list({ status: openStatuses, pageSize: 100 }, signal))
  const summary = useAsync((signal) => paymentsApi.summary({ from: today, to: today }, signal), [today])
  const recent = useAsync((signal) => paymentsApi.list({ from: today, to: today, pageSize: 8 }, signal), [today])
  const [paying, setPaying] = useState<Order | null>(null)
  const [closing, setClosing] = useState<string | null>(null)

  const refreshTakings = () => {
    summary.reload()
    recent.reload()
  }

  const upsert = (order: Order) =>
    orders.setData((page) => {
      const items = (page?.items ?? []).filter((o) => o.id !== order.id)
      if (openStatuses.includes(order.status)) items.push(order)
      return { page: 1, pageSize: 100, totalCount: items.length, totalPages: 1, ...page, items }
    })

  useRealtimeEvent<Order>('orderCreated', upsert)
  useRealtimeEvent<Order>('orderUpdated', (o) => {
    upsert(o)
    refreshTakings()
  })

  const list = useMemo(() => orders.data?.items ?? [], [orders.data])
  const toCollect = list
    .filter((o) => o.paymentStatus !== 'Paid' && outstandingOf(o) > 0)
    .sort((a, b) => billOrder[a.status] - billOrder[b.status] || a.createdAt.localeCompare(b.createdAt))
  const toClose = list.filter((o) => o.paymentStatus === 'Paid' && (o.status === 'Served' || o.status === 'Ready'))
  const openTotal = toCollect.reduce((sum, o) => sum + outstandingOf(o), 0)

  const close = async (order: Order) => {
    setClosing(order.id)
    try {
      upsert(await ordersApi.setStatus(order.id, 'Completed'))
      toast.success(t('Order closed'), `${order.tableName ?? t('Takeaway')} · #${order.number}`)
    } catch (err) {
      toast.error(t('Could not close the order'), getErrorMessage(err))
    } finally {
      setClosing(null)
    }
  }

  if (orders.error && !orders.data) return <ErrorState message={orders.error} onRetry={orders.reload} />

  const byMethod = summary.data ? (Object.entries(summary.data.byMethod) as [PaymentMethod, number][]).filter(([, v]) => v > 0) : []
  const maxMethod = Math.max(1, ...byMethod.map(([, v]) => v))

  return (
    <>
      <WorkspaceHero
        image={restaurant?.coverImageUrl}
        eyebrow={`${t('Cash desk')} · ${todayLabel()}`}
        title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? ''}`}
        description={t("Collect open bills, close paid orders and keep an eye on today's takings.")}
        stats={[
          { label: t('Collected today'), value: summary.data ? money(summary.data.paidTotal) : '–', highlight: true },
          { label: t('Payments'), value: summary.data?.paidCount ?? '–' },
          { label: t('Open bills'), value: orders.data ? toCollect.length : '–' },
          { label: t('To collect'), value: orders.data ? money(openTotal) : '–' },
        ]}
        actions={
          <>
            <Link to="/payments" className={heroPrimary}>
              <History className="size-4" /> {t('Payment history')}
            </Link>
            <Link to="/orders" className={heroSecondary}>
              <ReceiptText className="size-4" /> {t('All orders')}
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title={<span className="flex items-center gap-2"><Wallet className="size-4" /> {t('Open bills')}</span>}
              description={t('Served tables first — they are waiting for the bill.')}
            />
            {!orders.data ? (
              <div className="space-y-2 p-5"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
            ) : toCollect.length === 0 ? (
              <p className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted">
                <CheckCircle2 className="size-4 text-success" /> {t('Every bill is settled.')}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {toCollect.map((o) => (
                  <li key={o.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4', o.status === 'Served' && 'bg-brand-soft/60')}>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{o.tableName ?? t('Takeaway')}</span>
                        <span className="text-sm text-muted">#{o.number}</span>
                        <OrderStatusBadge status={o.status} />
                        {o.paymentStatus !== 'Pending' && <PaymentStatusBadge status={o.paymentStatus} />}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-ink tabular-nums">{money(outstandingOf(o))}</p>
                      {o.paidAmount > 0 && <p className="text-xs text-muted">{t('of {total}', { total: money(o.total) })}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/orders/${o.id}`}><Button variant="secondary" size="sm">{t('Details')}</Button></Link>
                      <Button size="sm" icon={<Wallet className="size-4" />} onClick={() => setPaying(o)}>{t('Take payment')}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {toClose.length > 0 && (
            <Card>
              <CardHeader title={<span className="flex items-center gap-2"><Lock className="size-4" /> {t('Paid · ready to close')}</span>} description={t('Their tables are already free — close the orders to finish them.')} />
              <ul className="divide-y divide-line">
                {toClose.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-ink">{o.tableName ?? t('Takeaway')}</span> <span className="text-muted">#{o.number} · {money(o.total)}</span>
                    </span>
                    <Button size="sm" variant="secondary" loading={closing === o.id} onClick={() => close(o)}>{t('Close order')}</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t('Today by method')} description={summary.data ? t('{paid} payments · {failed} declined', { paid: summary.data.paidCount, failed: summary.data.failedCount }) : undefined} />
            <div className="space-y-3 p-5">
              {!summary.data ? (
                <Skeleton className="h-24" />
              ) : byMethod.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">{t('No payments yet today.')}</p>
              ) : (
                byMethod.map(([m, v]) => {
                  const Icon = methodIcons[m]
                  return (
                    <div key={m}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium text-ink"><Icon className="size-4 text-brand-ink" /> {paymentMethodLabel(m)}</span>
                        <span className="tabular-nums">{money(v)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(4, (v / maxMethod) * 100)}%` }} />
                      </div>
                    </div>
                  )
                })
              )}
              {summary.data && summary.data.refundedTotal > 0 && (
                <p className="border-t border-line pt-3 text-xs text-muted">{t('Refunded today: {amount}', { amount: money(summary.data.refundedTotal) })}</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t('Latest payments')}
              action={<Link to="/payments" className="text-sm font-medium text-brand-ink underline-offset-4 hover:underline">{t('All')}</Link>}
            />
            {!recent.data ? (
              <div className="p-5"><Skeleton className="h-32" /></div>
            ) : recent.data.items.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted">{t('Nothing yet.')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.data.items.map((p) => {
                  const Icon = methodIcons[p.method]
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{p.tableName ?? t('Takeaway')} · #{p.orderNumber}</span>
                        <span className="block text-xs text-muted">{formatTime(p.createdAt)} · {paymentMethodLabel(p.method)}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold tabular-nums">{money(p.amount)}</span>
                        {p.status !== 'Paid' && <Badge tone={p.status === 'Failed' ? 'danger' : 'neutral'} className="mt-0.5">{paymentStatusLabel(p.status)}</Badge>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <TakePaymentModal
        order={paying}
        onClose={() => setPaying(null)}
        onDone={(o) => {
          upsert(o)
          refreshTakings()
          setPaying(null)
        }}
      />
    </>
  )
}

function TakePaymentModal({ order, onClose, onDone }: { order: Order | null; onClose: () => void; onDone: (o: Order) => void }) {
  const { restaurant, money } = useRestaurant()
  const { t } = useI18n()
  const toast = useToast()
  const methods = restaurant?.settings.enabledPaymentMethods ?? ['Cash', 'Card', 'Online', 'Test']
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? 'Cash')
  const [amount, setAmount] = useState('')
  const [closeAfter, setCloseAfter] = useState(true)
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset the form whenever a different bill is opened.
  const [forId, setForId] = useState<string | null>(null)
  if (order && order.id !== forId) {
    setForId(order.id)
    setAmount('')
    setSimulateFailure(false)
    setCloseAfter(true)
  }

  const outstanding = order ? outstandingOf(order) : 0
  const charge = amount ? Number(amount) : outstanding

  const pay = async () => {
    if (!order) return
    setSaving(true)
    try {
      const result = await paymentsApi.pay({ orderId: order.id, method, amount: amount ? Number(amount) : null, simulateFailure, completeOrder: closeAfter })
      if (result.payment.status === 'Paid') {
        toast.success(t('Payment received'), `${money(result.payment.amount)} · ${order.tableName ?? t('Takeaway')}`)
        onDone(result.order)
      } else {
        toast.error(t('Payment declined'), result.payment.failureReason ?? undefined)
      }
    } catch (err) {
      toast.error(t('Payment could not be processed'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={order ? `${order.tableName ?? t('Takeaway')} · #${order.number}` : ''}
      description={order ? t('{amount} to collect', { amount: money(outstanding) }) : undefined}
      initialFocus="panel"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button loading={saving} disabled={charge <= 0 || charge > outstanding} onClick={pay}>{t('Charge {amount}', { amount: money(charge) })}</Button>
        </>
      }
    >
      {order && (
        <div className="space-y-5">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-surface p-3 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span><span className="font-semibold tabular-nums">{i.quantity}×</span> {i.productName}</span>
                <span className="tabular-nums">{money(i.lineTotal)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-line pt-1.5 font-semibold">
              <span>{t('Total')}</span>
              <span className="tabular-nums">{money(order.total)}</span>
            </li>
          </ul>

          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const Icon = methodIcons[m]
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    'flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                    method === m ? 'border-brand bg-brand text-brand-fg' : 'border-line hover:border-brand/40',
                  )}
                >
                  <Icon className="size-4" /> {paymentMethodLabel(m)}
                </button>
              )
            })}
          </div>

          <Field label={t('Amount')} hint={t('Leave empty to charge the full balance ({amount}).', { amount: money(outstanding) })}>
            {(id) => <Input id={id} type="number" min={0} step="0.01" max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={outstanding.toFixed(2)} />}
          </Field>
          <div className="space-y-2">
            <Checkbox checked={closeAfter} onChange={setCloseAfter} label={t('Close the order when fully paid')} />
            <Checkbox checked={simulateFailure} onChange={setSimulateFailure} label={t('Simulate declined payment (test)')} />
          </div>
          <p className="text-xs text-muted">{t('The table becomes available as soon as the bill is fully paid. Test mode · no real payment provider is connected.')}</p>
        </div>
      )}
    </Modal>
  )
}
