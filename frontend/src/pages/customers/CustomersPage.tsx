import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, PageHeader, Pagination, SearchInput, td, th } from '@/components/ui/Layout'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { customersApi } from '@/lib/endpoints'
import { formatDate, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { CustomerFormModal } from './CustomerFormModal'

export function CustomersPage() {
  const { money } = useRestaurant()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload } = useAsync((signal) => customersApi.list({ search: debounced || undefined, page, pageSize: 20 }, signal), [debounced, page])

  return (
    <>
      <PageHeader
        title={t('Customers')}
        description={t('Guests who ordered, booked a table or registered — sorted by total spending.')}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{t('Add customer')}</Button>}
      />
      <SearchInput value={search} onChange={setSearch} placeholder={t('Search name, phone or email…')} className="mb-5 sm:max-w-sm" />
      <Card>
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title={t('No customers found')} />}>
          {(result) => (
            <>
              <DataTable
                head={
                  <tr>
                    <th className={th}>{t('Customer')}</th>
                    <th className={th}>{t('Phone')}</th>
                    <th className={`${th} text-right`}>{t('Orders')}</th>
                    <th className={`${th} text-right`}>{t('Total spending')}</th>
                    <th className={th}>{t('Last order')}</th>
                    <th className={th}>{t('Registered')}</th>
                  </tr>
                }
              >
                {result.items.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="cursor-pointer hover:bg-surface/60">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-fg">
                          {c.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <Link to={`/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink">{c.name}</Link>
                          <p className="truncate text-xs text-muted">{c.email ?? '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{c.phone ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>{c.orderCount}</td>
                    <td className={`${td} text-right font-medium tabular-nums`}>{money(c.totalSpending)}</td>
                    <td className={`${td} text-muted`}>{c.lastOrderAt ? timeAgo(c.lastOrderAt) : '—'}</td>
                    <td className={`${td} text-muted`}>{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </DataTable>
              <Pagination page={result.page} totalPages={result.totalPages} totalCount={result.totalCount} onChange={setPage} />
            </>
          )}
        </AsyncBlock>
      </Card>
      <CustomerFormModal customer={adding ? 'new' : null} onClose={() => setAdding(false)} onSaved={(c) => { setAdding(false); navigate(`/customers/${c.id}`) }} />
    </>
  )
}
