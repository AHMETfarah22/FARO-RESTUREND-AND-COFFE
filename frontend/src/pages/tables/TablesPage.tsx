import { useMemo, useState, type FormEvent } from 'react'
import { MapPin, MoreVertical, Pencil, Plus, QrCode, Trash2, Users } from 'lucide-react'
import { Link } from 'react-router'
import { TableStatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Field, Input, Select } from '@/components/ui/Form'
import { PageHeader, Tabs } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { AsyncBlock, EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { tableStatusLabel } from '@/lib/labels'
import { tablesApi, type TableInput } from '@/lib/endpoints'
import type { DiningTable, TableStatus } from '@/types/api'

const statuses: TableStatus[] = ['Available', 'Occupied', 'Reserved', 'Cleaning', 'Disabled']

export function TablesPage() {
  const { can } = useAuth()
  const { money } = useRestaurant()
  const toast = useToast()
  const { t, lang } = useI18n()
  const confirm = useConfirm()
  const { data, error, loading, reload, setData } = useAsync((signal) => tablesApi.list(signal))
  const [filter, setFilter] = useState<'All' | TableStatus>('All')
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null)

  useRealtimeEvent('tablesChanged', reload)

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: data?.length ?? 0 }
    for (const s of statuses) c[s] = data?.filter((tb) => tb.status === s).length ?? 0
    return c
  }, [data])

  const visible = data?.filter((tb) => filter === 'All' || tb.status === filter) ?? []

  const changeStatus = async (table: DiningTable, status: TableStatus) => {
    try {
      const updated = await tablesApi.setStatus(table.id, status)
      setData((list) => list!.map((tb) => (tb.id === updated.id ? updated : tb)))
      toast.success(t('{table} is now {status}', { table: table.name, status: tableStatusLabel(status).toLocaleLowerCase(lang === 'tr' ? 'tr' : 'en') }))
    } catch (err) {
      toast.error(t('Could not update the table'), getErrorMessage(err))
    }
  }

  const remove = async (table: DiningTable) => {
    if (!(await confirm({ title: t('Delete {table}?', { table: table.name }), message: t('Its QR code will stop working. Order history is kept.'), confirmLabel: t('Delete table'), danger: true }))) return
    try {
      await tablesApi.remove(table.id)
      setData((list) => list!.filter((tb) => tb.id !== table.id))
      toast.success(t('{table} deleted', { table: table.name }))
    } catch (err) {
      toast.error(t('Could not delete the table'), getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t('Tables')}
        description={t('Floor overview with live status. Every table has its own QR menu.')}
        actions={
          <>
            <Link to="/qr-codes">
              <Button variant="secondary" icon={<QrCode className="size-4" />}>
                {t('All QR codes')}
              </Button>
            </Link>
            {can('tablesManage') && (
              <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
                {t('Add table')}
              </Button>
            )}
          </>
        }
      />

      <Tabs
        className="mb-5"
        value={filter}
        onChange={setFilter}
        options={[{ value: 'All' as const, label: t('All'), count: counts.All }, ...statuses.map((s) => ({ value: s, label: tableStatusLabel(s), count: counts[s] }))]}
      />

      <AsyncBlock
        data={data}
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton={<div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>}
      >
        {() =>
          visible.length === 0 ? (
            <Card>
              <EmptyState title={t('No tables here')} description={filter === 'All' ? t('Add your first table to generate its QR menu.') : t('No table is {status}.', { status: tableStatusLabel(filter).toLocaleLowerCase(lang === 'tr' ? 'tr' : 'en') })} />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {visible.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  openAmount={table.openAmount ? money(table.openAmount) : null}
                  canManage={can('tablesManage')}
                  onEdit={() => setEditing(table)}
                  onDelete={() => remove(table)}
                  onStatus={(s) => changeStatus(table, s)}
                />
              ))}
            </div>
          )
        }
      </AsyncBlock>

      <TableFormModal
        table={editing}
        existingNumbers={data?.map((tb) => tb.number) ?? []}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setData((list) => {
            const exists = list?.some((tb) => tb.id === saved.id)
            const next = exists ? list!.map((tb) => (tb.id === saved.id ? saved : tb)) : [...(list ?? []), saved]
            return next.sort((a, b) => a.number - b.number)
          })
          setEditing(null)
        }}
      />
    </>
  )
}

function TableCard({
  table,
  openAmount,
  canManage,
  onEdit,
  onDelete,
  onStatus,
}: {
  table: DiningTable
  openAmount: string | null
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  onStatus: (status: TableStatus) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { t } = useI18n()
  return (
    <Card className={cn('relative flex flex-col p-5', table.status === 'Occupied' && 'border-ink', table.status === 'Disabled' && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-3xl leading-none font-semibold text-ink">{String(table.number).padStart(2, '0')}</p>
          <p className="mt-1 text-xs tracking-wide text-muted uppercase">{table.name}</p>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="-mr-2 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label={t('Actions for {table}', { table: table.name })}>
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute top-8 right-0 z-20 w-44 rounded-xl border border-line bg-paper p-1 shadow-xl">
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{t('Set status')}</p>
                {statuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={s === table.status}
                    onClick={() => {
                      setMenuOpen(false)
                      onStatus(s)
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface disabled:font-semibold disabled:text-ink"
                  >
                    {tableStatusLabel(s)}
                  </button>
                ))}
                {canManage && (
                  <>
                    <div className="my-1 border-t border-line" />
                    <button type="button" onClick={() => { setMenuOpen(false); onDelete() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger/5">
                      <Trash2 className="size-4" /> {t('Delete')}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm text-muted">
        <p className="flex items-center gap-2"><Users className="size-4" /> {t('{n} persons', { n: table.capacity })}</p>
        {table.location && <p className="flex items-center gap-2"><MapPin className="size-4" /> {table.location}</p>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <TableStatusBadge status={table.status} />
        {openAmount && <span className="text-sm font-semibold text-ink tabular-nums">{openAmount}</span>}
      </div>
      {table.activeOrders > 0 && (
        <Link to={`/orders?tableId=${table.id}`} className="mt-2 text-xs text-muted underline-offset-4 hover:text-ink hover:underline">
          {t('{n} open order(s)', { n: table.activeOrders })}
        </Link>
      )}

      <div className="mt-auto flex gap-2 pt-4">
        <Link to={`/tables/${table.id}/qr`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full" icon={<QrCode className="size-4" />}>
            {t('View QR')}
          </Button>
        </Link>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={onEdit} aria-label={t('Edit {table}', { table: table.name })}>
            <Pencil className="size-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}

function TableFormModal({
  table,
  existingNumbers,
  onClose,
  onSaved,
}: {
  table: DiningTable | 'new' | null
  existingNumbers: number[]
  onClose: () => void
  onSaved: (table: DiningTable) => void
}) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = table === 'new'
  const initial: TableInput =
    table && table !== 'new'
      ? { number: table.number, capacity: table.capacity, location: table.location, status: table.status }
      : { number: (existingNumbers.length ? Math.max(...existingNumbers) : 0) + 1, capacity: 4, location: '', status: 'Available' }

  const [form, setForm] = useState<TableInput>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)

  // Reset the form whenever a different table is opened.
  const key = table === null ? null : isNew ? 'new' : table.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setErrors({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input = { ...form, location: form.location?.trim() || null }
      const saved = isNew ? await tablesApi.create(input) : await tablesApi.update((table as DiningTable).id, input)
      toast.success(isNew ? t('{table} created', { table: saved.name }) : t('{table} updated', { table: saved.name }))
      onSaved(saved)
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save the table'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={table !== null}
      onClose={onClose}
      title={isNew ? t('Add table') : t('Edit table {number}', { number: String(form.number).padStart(2, '0') })}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" form="table-form" loading={saving}>{isNew ? t('Create table') : t('Save')}</Button>
        </>
      }
    >
      <form id="table-form" onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
        <Field label={t('Table number')} error={errors.number} required>
          {(id) => <Input id={id} type="number" min={1} value={form.number} onChange={(e) => setForm({ ...form, number: Number(e.target.value) })} invalid={!!errors.number} />}
        </Field>
        <Field label={t('Capacity')} error={errors.capacity} required>
          {(id) => <Input id={id} type="number" min={1} max={50} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} invalid={!!errors.capacity} />}
        </Field>
        <Field label={t('Location')} hint={t('e.g. Window, Terrace, VIP Room')} error={errors.location} className="col-span-2">
          {(id) => <Input id={id} value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} />}
        </Field>
        <Field label={t('Status')} className="col-span-2">
          {(id) => (
            <Select id={id} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TableStatus })}>
              {statuses.map((s) => <option key={s} value={s}>{tableStatusLabel(s)}</option>)}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}
