import { useState } from 'react'
import { Banknote, CreditCard, FlaskConical, Globe } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { OrderStatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Form'
import { DataTable, PageHeader, Pagination, StatCard, td, th } from '@/components/ui/Layout'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { ordersApi, paymentsApi } from '@/lib/endpoints'
import { formatDateTime, timeAgo, toIsoDate } from '@/lib/format'
import type { PaymentMethod, PaymentStatus } from '@/types/api'

const methods: PaymentMethod[] = ['Cash', 'Card', 'Online', 'Test']
const methodIcons: Record<PaymentMethod, typeof Banknote> = { Cash: Banknote, Card: CreditCard, Online: Globe, Test: FlaskConical }

export function PaymentsPage() {
  const { money } = useRestaurant()
  const navigate = useNavigate()
  const [from, setFrom] = useState(() => toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(() => toIsoDate(new Date()))
  const [status, setStatus] = useState<'' | PaymentStatus>('')
  const [method, setMethod] = useState<'' | PaymentMethod>('')
  const [page, setPage] = useState(1)

  const summary = useAsync((signal) => paymentsApi.summary({ from, to }, signal), [from, to])
  const list = useAsync(
    (signal) => paymentsApi.list({ from, to, status: status || undefined, method: method || undefined, page, pageSize: 20 }, signal),
    [from, to, status, method, page],
  )
  // Orders that are served/ready but not paid yet — the cashier's queue.
  const awaiting = useAsync((signal) => ordersApi.list({ status: ['Ready', 'Served'], paymentStatus: 'Pending', pageSize: 50 }, signal))

  const refresh = () => {
    summary.reload()
    list.reload()
    awaiting.reload()
  }
  useRealtimeEvent('orderUpdated', refresh)

  return (
    <>
      <PageHeader title="Payments" description="Simulated payments for the test environment — ready for Stripe or Iyzico later." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Collected" value={summary.data ? money(summary.data.paidTotal, { compact: true }) : '—'} hint={summary.data ? `${summary.data.paidCount} payments` : undefined} />
        <StatCard label="Refunded" value={summary.data ? money(summary.data.refundedTotal, { compact: true }) : '—'} />
        <StatCard label="Failed" value={summary.data?.failedCount ?? '—'} hint="declined attempts" />
        <Card className="col-span-2 p-5 xl:col-span-1">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">By method</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {methods.map((m) => {
              const Icon = methodIcons[m]
              return (
                <li key={m} className="flex items-center gap-2">
                  <Icon className="size-4 text-muted" />
                  <span className="text-muted">{m}</span>
                  <span className="ml-auto font-medium tabular-nums">{summary.data ? money(summary.data.byMethod[m] ?? 0, { compact: true }) : '—'}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Awaiting payment" description="Ready or served orders without payment" />
        <AsyncBlock data={awaiting.data} loading={awaiting.loading} error={awaiting.error} onRetry={awaiting.reload} isEmpty={(d) => d.items.length === 0} empty={<p className="px-6 py-8 text-center text-sm text-muted">No unpaid orders right now.</p>}>
          {(result) => (
            <ul className="divide-y divide-line">
              {result.items.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface/60">
                    <span className="w-16 font-semibold tabular-nums">#{o.number}</span>
                    <span className="flex-1 text-sm">{o.tableName ?? 'Takeaway'}{o.customerName ? ` · ${o.customerName}` : ''}</span>
                    <span className="hidden text-xs text-muted sm:block">{timeAgo(o.createdAt)}</span>
                    <OrderStatusBadge status={o.status} />
                    <span className="w-24 text-right font-semibold tabular-nums">{money(o.total - o.paidAmount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AsyncBlock>
      </Card>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <h2 className="mr-auto font-semibold text-ink">Transactions</h2>
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} aria-label="Start date" className="sm:w-40" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} aria-label="End date" className="sm:w-40" />
          </div>
          <div className="flex gap-2">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as '' | PaymentStatus); setPage(1) }} aria-label="Status" className="sm:w-36">
              <option value="">All statuses</option>
              {(['Paid', 'Failed', 'Refunded', 'Pending'] as PaymentStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select value={method} onChange={(e) => { setMethod(e.target.value as '' | PaymentMethod); setPage(1) }} aria-label="Method" className="sm:w-36">
              <option value="">All methods</option>
              {methods.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        </div>
        <AsyncBlock data={list.data} loading={list.loading} error={list.error} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title="No payments in this period" />}>
          {(result) => (
            <>
              <DataTable
                head={
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Order</th>
                    <th className={th}>Method</th>
                    <th className={th}>Status</th>
                    <th className={th}>Reference</th>
                    <th className={`${th} text-right`}>Amount</th>
                  </tr>
                }
              >
                {result.items.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/orders/${p.orderId}`)} className="cursor-pointer hover:bg-surface/60">
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(p.createdAt)}</td>
                    <td className={td}><span className="font-semibold">#{p.orderNumber}</span> <span className="text-muted">{p.tableName ?? ''}</span></td>
                    <td className={td}>{p.method}</td>
                    <td className={td}>
                      <Badge tone={p.status === 'Paid' ? 'success' : p.status === 'Failed' ? 'danger' : 'neutral'}>{p.status}</Badge>
                      {p.failureReason && <p className="mt-1 text-xs text-muted">{p.failureReason}</p>}
                    </td>
                    <td className={`${td} font-mono text-xs text-muted`}>{p.transactionReference ?? '—'}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{money(p.amount)}</td>
                  </tr>
                ))}
              </DataTable>
              <Pagination page={result.page} totalPages={result.totalPages} totalCount={result.totalCount} onChange={setPage} />
            </>
          )}
        </AsyncBlock>
      </Card>
    </>
  )
}
