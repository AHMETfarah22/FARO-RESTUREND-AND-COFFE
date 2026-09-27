import { useState } from 'react'
import { Mail, Pencil, Phone, StickyNote, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { OrderStatusBadge, ReservationStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { PageHeader, StatCard } from '@/components/ui/Layout'
import { AsyncBlock } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { customersApi } from '@/lib/endpoints'
import { formatDate, formatDateOnly, formatDateTime, formatTimeOnly } from '@/lib/format'
import { CustomerFormModal } from './CustomerFormModal'

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const { money } = useRestaurant()
  const { t } = useI18n()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const { data, error, loading, reload } = useAsync((signal) => customersApi.get(id, signal), [id])

  const remove = async () => {
    if (!data || !(await confirm({ title: t('Delete {name}?', { name: data.customer.name }), message: t('Their orders and reservations stay in the history.'), confirmLabel: t('Delete customer'), danger: true }))) return
    try {
      await customersApi.remove(id)
      toast.success(t('Customer deleted'))
      navigate('/customers')
    } catch (err) {
      toast.error(t('Could not delete the customer'), getErrorMessage(err))
    }
  }

  return (
    <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
      {({ customer, orders, reservations }) => (
        <>
          <PageHeader
            back={{ to: '/customers', label: t('Customers') }}
            title={customer.name}
            description={t('Customer since {date}', { date: formatDate(customer.createdAt) })}
            actions={
              <>
                <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>{t('Edit')}</Button>
                {can('customersDelete') && <Button variant="secondary" className="text-danger" icon={<Trash2 className="size-4" />} onClick={remove}>{t('Delete')}</Button>}
              </>
            }
          />

          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="p-5 lg:row-span-2">
              <h2 className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t('Customer information')}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center gap-3"><Phone className="size-4 text-muted" />{customer.phone ?? '—'}</li>
                <li className="flex items-center gap-3 break-all"><Mail className="size-4 shrink-0 text-muted" />{customer.email ?? '—'}</li>
                {customer.notes && <li className="flex gap-3"><StickyNote className="mt-0.5 size-4 shrink-0 text-muted" />{customer.notes}</li>}
              </ul>
            </Card>
            <StatCard label={t('Total spending')} value={money(customer.totalSpending)} />
            <StatCard label={t('Orders')} value={customer.orderCount} />
            <StatCard label={t('Last order')} value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={t('Order history')} description={t('{n} most recent', { n: orders.length })} />
              {orders.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted">{t('No orders yet.')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/orders/${o.id}`} className="flex items-center gap-4 px-6 py-3.5 hover:bg-surface/60">
                        <span className="w-14 font-semibold tabular-nums">#{o.number}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</span>
                          <span className="block text-xs text-muted">{formatDateTime(o.createdAt)} · {o.tableName ?? t('Takeaway')}</span>
                        </span>
                        <OrderStatusBadge status={o.status} />
                        <span className="w-24 text-right text-sm font-medium tabular-nums">{money(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title={t('Reservations')} />
              {reservations.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted">{t('No reservations.')}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {reservations.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-6 py-3.5 text-sm">
                      <div>
                        <p className="font-medium">{formatDateOnly(r.date)} · {formatTimeOnly(r.time)}</p>
                        <p className="text-xs text-muted">{t('{n} people', { n: r.partySize })} · {r.tableName ?? t('No table')}</p>
                      </div>
                      <ReservationStatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <CustomerFormModal customer={editing ? customer : null} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload() }} />
        </>
      )}
    </AsyncBlock>
  )
}
