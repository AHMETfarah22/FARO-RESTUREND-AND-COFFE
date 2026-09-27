import { useState } from 'react'
import { Banknote, CreditCard, FlaskConical, Globe, Pencil, Printer, QrCode, RotateCcw, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import { Receipt } from '@/components/Receipt'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Checkbox, Field, Input } from '@/components/ui/Form'
import { PageHeader } from '@/components/ui/Layout'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { nextActions } from '@/features/orders/workflow'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ordersApi, paymentsApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from '@/lib/labels'
import { canMoveOrderTo } from '@/lib/permissions'
import type { Order, OrderStatus, PaymentMethod } from '@/types/api'

const methodIcons: Record<PaymentMethod, typeof Banknote> = { Cash: Banknote, Card: CreditCard, Online: Globe, Test: FlaskConical }

export function OrderDetailPage({ id }: { id: string }) {
  const { can, user } = useAuth()
  const { t } = useI18n()
  const { money, restaurant } = useRestaurant()
  const toast = useToast()
  const confirm = useConfirm()
  const { data: order, error, reload, setData } = useAsync((signal) => ordersApi.get(id, signal), [id])
  const [busy, setBusy] = useState<OrderStatus | null>(null)

  useRealtimeEvent<Order>('orderUpdated', (o) => o.id === id && setData(o))

  if (error && !order) return <ErrorState message={error} onRetry={reload} />
  if (!order) return <LoadingState />

  const changeStatus = async (to: OrderStatus) => {
    if (to === 'Cancelled' && !(await confirm({ title: t('Cancel order #{number}?', { number: order.number }), message: t('Tracked stock is returned and the table is freed.'), confirmLabel: t('Cancel order'), danger: true })))
      return
    setBusy(to)
    try {
      setData(await ordersApi.setStatus(order.id, to))
      toast.success(t('Order #{number} → {status}', { number: order.number, status: orderStatusLabel(to) }))
    } catch (err) {
      toast.error(t('Could not update the order'), getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const outstanding = Math.max(0, Math.round((order.total - order.paidAmount) * 100) / 100)
  const editable = can('ordersCreate') && ['Pending', 'Confirmed'].includes(order.status)
  // Only the steps that belong to this role (the kitchen cooks, the waiter serves, the cashier closes).
  const steps = nextActions[order.status].filter((a) => canMoveOrderTo(user?.roles, a.to))

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ to: '/orders', label: t('Orders') }}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {t('Order #{number}', { number: order.number })}
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </span>
          }
          description={`${order.tableName ?? t('Takeaway')} · ${formatDateTime(order.createdAt)}`}
          actions={
            <>
              {editable && (
                <Link to={`/orders/${order.id}/edit`}>
                  <Button variant="secondary" icon={<Pencil className="size-4" />}>{t('Edit')}</Button>
                </Link>
              )}
              <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>{t('Print receipt')}</Button>
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            {steps.length > 0 && (
              <Card className="p-5">
                <p className="mb-3 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t('Next step')}</p>
                <div className="flex flex-wrap gap-2">
                  {steps.map((a) => (
                    <Button
                      key={a.to}
                      size="lg"
                      variant={a.danger ? 'secondary' : a.primary ? 'primary' : 'secondary'}
                      className={cn(a.danger && 'border-danger/40 text-danger hover:bg-danger/5')}
                      loading={busy === a.to}
                      disabled={!!busy || (a.to === 'Completed' && order.paymentStatus !== 'Paid')}
                      title={a.to === 'Completed' && order.paymentStatus !== 'Paid' ? t('Take payment first') : undefined}
                      onClick={() => changeStatus(a.to)}
                    >
                      {t(a.label)}
                    </Button>
                  ))}
                </div>
                {steps.some((a) => a.to === 'Completed') && order.paymentStatus !== 'Paid' && (
                  <p className="mt-3 text-xs text-muted">{t('Take the payment first — the order can be closed once the bill is paid, and the table is freed right away.')}</p>
                )}
              </Card>
            )}

            <Card>
              <CardHeader
                title={t('Items')}
                description={
                  <span className="inline-flex items-center gap-1.5">
                    {order.source === 'QrMenu' ? <><QrCode className="size-3.5" /> {t('Ordered from QR menu')}</> : <><UserRound className="size-3.5" /> {t('Entered by staff')}</>}
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-start gap-4 px-6 py-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-sm font-semibold tabular-nums">{i.quantity}×</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{i.productName}</p>
                      <p className="text-xs text-muted tabular-nums">{t('{price} each', { price: money(i.unitPrice) })}</p>
                      {i.notes && <p className="mt-1 text-sm text-ink-800 italic">“{i.notes}”</p>}
                    </div>
                    <p className="font-semibold tabular-nums">{money(i.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className="space-y-1.5 border-t border-line px-6 py-5 text-sm">
                <div className="flex justify-between"><dt className="text-muted">{t('Subtotal')}</dt><dd className="tabular-nums">{money(order.subtotal)}</dd></div>
                {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">{t('Discount')}</dt><dd className="tabular-nums">−{money(order.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted">{t('Tax ({rate}%)', { rate: order.taxRate })}</dt><dd className="tabular-nums">{money(order.taxAmount)}</dd></div>
                <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold"><dt>{t('Total')}</dt><dd className="tabular-nums">{money(order.total)}</dd></div>
              </dl>
              {order.notes && <p className="border-t border-line px-6 py-4 text-sm"><span className="text-muted">{t('Order note:')} </span>{order.notes}</p>}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <dl className="space-y-3 text-sm">
                <Row label={t('Table')} value={order.tableName ?? t('Takeaway')} />
                <Row label={t('Customer')} value={order.customerId ? <Link to={`/customers/${order.customerId}`} className="underline underline-offset-4">{order.customerName}</Link> : order.customerName ?? t('Walk-in')} />
                <Row label={t('Created')} value={formatDateTime(order.createdAt)} />
                {order.completedAt && <Row label={t('Closed')} value={formatDateTime(order.completedAt)} />}
              </dl>
            </Card>

            <PaymentPanel order={order} outstanding={outstanding} onPaid={setData} />
          </div>
        </div>
      </div>

      <Receipt order={order} restaurant={restaurant} money={money} />
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  )
}

/** Cashier panel: simulated payments (no real provider in the test build) and refunds. */
function PaymentPanel({ order, outstanding, onPaid }: { order: Order; outstanding: number; onPaid: (o: Order) => void }) {
  const { can } = useAuth()
  const { t } = useI18n()
  const { money, restaurant } = useRestaurant()
  const toast = useToast()
  const confirm = useConfirm()
  const methods = restaurant?.settings.enabledPaymentMethods ?? ['Cash', 'Card', 'Online', 'Test']
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? 'Cash')
  const [amount, setAmount] = useState('')
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [closeAfter, setCloseAfter] = useState(true)
  const [paying, setPaying] = useState(false)

  const canPay = can('payments') && order.status !== 'Cancelled' && outstanding > 0

  const pay = async () => {
    setPaying(true)
    try {
      const result = await paymentsApi.pay({
        orderId: order.id,
        method,
        amount: amount ? Number(amount) : null,
        simulateFailure,
        completeOrder: closeAfter,
      })
      onPaid(result.order)
      setAmount('')
      if (result.payment.status === 'Paid') toast.success(t('Payment received'), `${money(result.payment.amount)} · ${result.payment.transactionReference}`)
      else toast.error(t('Payment failed'), result.payment.failureReason ?? undefined)
    } catch (err) {
      toast.error(t('Payment could not be processed'), getErrorMessage(err))
    } finally {
      setPaying(false)
    }
  }

  const refund = async (paymentId: string, value: number) => {
    if (!(await confirm({ title: t('Refund this payment?'), message: t('{amount} will be marked as refunded.', { amount: money(value) }), confirmLabel: t('Refund'), danger: true }))) return
    try {
      const result = await paymentsApi.refund(paymentId)
      onPaid(result.order)
      toast.success(t('Payment refunded'))
    } catch (err) {
      toast.error(t('Refund failed'), getErrorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader title={t('Payment')} description={outstanding > 0 ? t('{amount} outstanding', { amount: money(outstanding) }) : t('Fully paid')} />
      {canPay && (
        <div className="space-y-4 border-b border-line p-5">
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
                    method === m ? 'border-brand bg-brand text-brand-fg' : 'border-line hover:border-ink/40',
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
          <Button size="lg" className="w-full" loading={paying} onClick={pay}>
            {t('Charge {amount}', { amount: money(amount ? Number(amount) : outstanding) })}
          </Button>
          <p className="text-center text-xs text-muted">{t('The table becomes available as soon as the bill is fully paid · test mode, no real provider.')}</p>
        </div>
      )}
      {order.payments.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">{t('No payments yet.')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {order.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{money(p.amount)} · {paymentMethodLabel(p.method)}</p>
                <p className="truncate text-xs text-muted">{p.transactionReference ?? '—'} · {formatDateTime(p.createdAt)}</p>
              </div>
              <Badge tone={p.status === 'Paid' ? 'success' : p.status === 'Failed' ? 'danger' : 'neutral'}>{paymentStatusLabel(p.status)}</Badge>
              {p.status === 'Paid' && can('refunds') && (
                <button type="button" onClick={() => refund(p.id, p.amount)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label={t('Refund')}>
                  <RotateCcw className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
