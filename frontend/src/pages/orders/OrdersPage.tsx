import { useEffect, useState } from 'react'
import { Plus, QrCode, UserRound } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Form'
import { DataTable, PageHeader, Pagination, SearchInput, Tabs, td, th } from '@/components/ui/Layout'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthContext'
import { orderViews, type OrderView } from '@/features/orders/workflow'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { ordersApi } from '@/lib/endpoints'
import { formatDateTime, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'

export function OrdersPage({ view = 'all' }: { view?: OrderView }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const tableId = params.get('tableId') ?? undefined
  const { can } = useAuth()
  const { money } = useRestaurant()
  const { t } = useI18n()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useAsync(
    (signal) =>
      ordersApi.list(
        { status: orderViews[view].statuses, search: debounced || undefined, from: from || undefined, to: to || undefined, tableId, page, pageSize: 20 },
        signal,
      ),
    [view, debounced, from, to, page, tableId],
  )

  useRealtimeEvent('orderCreated', reload)
  useRealtimeEvent('orderUpdated', reload)

  return (
    <>
      <PageHeader
        title={t(orderViews[view].label)}
        description={tableId ? t('Filtered by table.') : t('All orders from staff and the QR menu, updated live.')}
        actions={can('ordersCreate') && (
          <Link to="/orders/new"><Button icon={<Plus className="size-4" />}>{t('New order')}</Button></Link>
        )}
      />

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={view}
          onChange={(v) => {
            setPage(1)
            navigate(v === 'all' ? '/orders' : `/orders/${v}`)
          }}
          options={(Object.keys(orderViews) as OrderView[]).map((v) => ({ value: v, label: v === 'all' ? t('All') : t(orderViews[v].label) }))}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder={t('Order #, table # or customer…')} className="sm:w-72" />
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} aria-label={t('From date')} className="sm:w-40" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} aria-label={t('To date')} className="sm:w-40" />
          </div>
        </div>
      </div>

      <Card>
        <AsyncBlock
          data={data}
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState title={t('No orders found')} description={t('Orders placed by staff or from the QR menu appear here instantly.')} />}
        >
          {(result) => (
            <>
              <DataTable
                head={
                  <tr>
                    <th className={th}>{t('Order')}</th>
                    <th className={th}>{t('Table')}</th>
                    <th className={th}>{t('Customer')}</th>
                    <th className={th}>{t('Items')}</th>
                    <th className={th}>{t('Status')}</th>
                    <th className={th}>{t('Payment')}</th>
                    <th className={`${th} text-right`}>{t('Total')}</th>
                    <th className={th}>{t('Created')}</th>
                  </tr>
                }
              >
                {result.items.map((o) => (
                  <tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)} className="cursor-pointer hover:bg-surface/60">
                    <td className={td}>
                      <Link to={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink tabular-nums">#{o.number}</Link>
                      <span className="ml-2 inline-flex text-muted" title={o.source === 'QrMenu' ? t('QR menu order') : t('Staff order')}>
                        {o.source === 'QrMenu' ? <QrCode className="size-3.5" /> : <UserRound className="size-3.5" />}
                      </span>
                    </td>
                    <td className={td}>{o.tableName ?? <span className="text-muted">{t('Takeaway')}</span>}</td>
                    <td className={td}>{o.customerName ?? <span className="text-muted">—</span>}</td>
                    <td className={`${td} max-w-[260px]`}>
                      <span className="block truncate text-muted">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</span>
                    </td>
                    <td className={td}><OrderStatusBadge status={o.status} /></td>
                    <td className={td}><PaymentStatusBadge status={o.paymentStatus} /></td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{money(o.total)}</td>
                    <td className={`${td} whitespace-nowrap text-muted`} title={formatDateTime(o.createdAt)}>{timeAgo(o.createdAt)}</td>
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
