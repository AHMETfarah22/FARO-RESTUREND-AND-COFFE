import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, History, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { DataTable, PageHeader, SearchInput, StatCard, Tabs, td, th } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { AsyncBlock, EmptyState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { inventoryApi, type InventoryInput } from '@/lib/endpoints'
import { formatDateTime, formatNumber, timeAgo } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { inventoryMoveLabel } from '@/lib/labels'
import type { InventoryItem, InventoryTransactionType } from '@/types/api'

export function InventoryPage() {
  const { money } = useRestaurant()
  const { t } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null)
  const [moving, setMoving] = useState<{ item: InventoryItem; type: InventoryTransactionType } | null>(null)
  const [history, setHistory] = useState<InventoryItem | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const { data, error, loading, reload, setData } = useAsync((signal) => inventoryApi.list({ search: debounced || undefined }, signal), [debounced])

  const items = data ?? []
  const low = items.filter((i) => i.isLowStock)
  const visible = filter === 'low' ? low : items
  const stockValue = items.reduce((s, i) => s + i.stockValue, 0)

  const replace = (item: InventoryItem) => setData((list) => list!.map((x) => (x.id === item.id ? item : x)))

  const remove = async (item: InventoryItem) => {
    if (!(await confirm({ title: t('Delete {name}?', { name: item.name }), message: t('Its stock history will be removed as well.'), confirmLabel: t('Delete item'), danger: true }))) return
    try {
      await inventoryApi.remove(item.id)
      setData((list) => list!.filter((x) => x.id !== item.id))
      toast.success(t('Item deleted'))
    } catch (err) {
      toast.error(t('Could not delete item'), getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t('Inventory')}
        description={t('Ingredients and supplies. Low stock raises a notification automatically.')}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>{t('Add item')}</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label={t('Items')} value={items.length} />
        <StatCard label={t('Low stock')} value={low.length} hint={low.length ? t('need reorder') : t('all good')} className={low.length ? 'border-warning/40' : undefined} />
        <StatCard label={t('Stock value')} value={money(stockValue, { compact: true })} hint={t('at purchase price')} className="col-span-2 lg:col-span-1" />
      </div>

      {low.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {low.map((item) => (
            <Card key={item.id} className="border-warning/40 p-4">
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-warning uppercase">
                <AlertTriangle className="size-4" /> {t('Low stock')}
              </p>
              <p className="mt-2 font-semibold text-ink">{item.name}</p>
              <p className="mt-1 text-sm text-muted">
                {t('Remaining')}: <strong className="text-ink">{formatNumber(item.quantity, 2)} {item.unit}</strong>
                <br />
                {t('Minimum')}: {formatNumber(item.minimumQuantity, 2)} {item.unit}
              </p>
              <Button size="sm" variant="secondary" className="mt-3" icon={<ArrowDownToLine className="size-4" />} onClick={() => setMoving({ item, type: 'StockIn' })}>
                {t('Receive stock')}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all' as const, label: t('All items'), count: items.length },
            { value: 'low' as const, label: t('Low stock'), count: low.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder={t('Search item or supplier…')} className="sm:w-72" />
      </div>

      <Card>
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
          {() =>
            visible.length === 0 ? (
              <EmptyState title={filter === 'low' ? t('Nothing is running low') : t('No inventory items')} />
            ) : (
              <DataTable
                head={
                  <tr>
                    <th className={th}>{t('Item')}</th>
                    <th className={th}>{t('Stock level')}</th>
                    <th className={th}>{t('Supplier')}</th>
                    <th className={`${th} text-right`}>{t('Purchase')}</th>
                    <th className={`${th} text-right`}>{t('Value')}</th>
                    <th className={th}>{t('Updated')}</th>
                    <th className={`${th} text-right`}>{t('Actions')}</th>
                  </tr>
                }
              >
                {visible.map((item) => {
                  const pct = item.minimumQuantity > 0 ? Math.min(100, (item.quantity / (item.minimumQuantity * 3)) * 100) : 100
                  return (
                    <tr key={item.id} className="hover:bg-surface/50">
                      <td className={td}>
                        <p className="font-medium text-ink">{item.name}</p>
                        <p className="text-xs text-muted">{t('Unit')}: {item.unit}</p>
                      </td>
                      <td className={`${td} min-w-[180px]`}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span className={cn('font-semibold tabular-nums', item.isLowStock && 'text-warning')}>{formatNumber(item.quantity, 2)} {item.unit}</span>
                          <span className="text-xs text-muted">{t('min {n}', { n: formatNumber(item.minimumQuantity, 2) })}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                          <div className={cn('h-full rounded-full', item.isLowStock ? 'bg-warning' : 'bg-brand')} style={{ width: `${Math.max(3, pct)}%` }} />
                        </div>
                      </td>
                      <td className={`${td} text-muted`}>{item.supplier ?? '—'}</td>
                      <td className={`${td} text-right tabular-nums`}>{money(item.purchasePrice)}</td>
                      <td className={`${td} text-right tabular-nums`}>{money(item.stockValue)}</td>
                      <td className={`${td} text-muted whitespace-nowrap`}>{item.updatedAt ? timeAgo(item.updatedAt) : '—'}</td>
                      <td className={`${td} text-right`}>
                        <div className="inline-flex gap-0.5">
                          <Button variant="ghost" size="sm" title={t('Stock in')} aria-label={t('Stock in')} onClick={() => setMoving({ item, type: 'StockIn' })}><ArrowDownToLine className="size-4" /></Button>
                          <Button variant="ghost" size="sm" title={t('Stock out')} aria-label={t('Stock out')} onClick={() => setMoving({ item, type: 'StockOut' })}><ArrowUpFromLine className="size-4" /></Button>
                          <Button variant="ghost" size="sm" title={t('Stock count')} aria-label={t('Stock count')} onClick={() => setMoving({ item, type: 'Adjustment' })}><SlidersHorizontal className="size-4" /></Button>
                          <Button variant="ghost" size="sm" title={t('History')} aria-label={t('History')} onClick={() => setHistory(item)}><History className="size-4" /></Button>
                          <Button variant="ghost" size="sm" title={t('Edit')} aria-label={t('Edit')} onClick={() => setEditing(item)}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" size="sm" title={t('Delete')} aria-label={t('Delete')} className="text-danger" onClick={() => remove(item)}><Trash2 className="size-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </DataTable>
            )
          }
        </AsyncBlock>
      </Card>

      <ItemModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      <MovementModal movement={moving} onClose={() => setMoving(null)} onSaved={(item) => { replace(item); setMoving(null) }} />
      <HistoryModal item={history} onClose={() => setHistory(null)} />
    </>
  )
}

function ItemModal({ item, onClose, onSaved }: { item: InventoryItem | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = item === 'new'
  const initial: InventoryInput =
    item && item !== 'new'
      ? { name: item.name, unit: item.unit, quantity: item.quantity, minimumQuantity: item.minimumQuantity, supplier: item.supplier, purchasePrice: item.purchasePrice, sellingPrice: item.sellingPrice }
      : { name: '', unit: 'kg', quantity: 0, minimumQuantity: 1, supplier: null, purchasePrice: 0, sellingPrice: null }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = item === null ? null : isNew ? 'new' : item.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setErrors({})
  }
  const set = <K extends keyof InventoryInput>(k: K, v: InventoryInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input = { ...form, name: form.name.trim(), unit: form.unit.trim(), supplier: form.supplier?.trim() || null }
      if (isNew) await inventoryApi.create(input)
      else await inventoryApi.update((item as InventoryItem).id, input)
      toast.success(isNew ? t('Item added') : t('Item updated'))
      onSaved()
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save item'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={isNew ? t('Add inventory item') : t('Edit inventory item')}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="item-form" loading={saving}>{t('Save')}</Button></>}
    >
      <form id="item-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('Name')} error={errors.name} required>
          {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} placeholder={t('Coffee Beans')} />}
        </Field>
        <Field label={t('Unit')} hint={t('kg, L, pcs…')} error={errors.unit} required>
          {(id) => <Input id={id} value={form.unit} onChange={(e) => set('unit', e.target.value)} invalid={!!errors.unit} />}
        </Field>
        <Field label={t('Stock quantity')} hint={isNew ? t('Opening stock') : t('Changes are logged as an adjustment.')} error={errors.quantity}>
          {(id) => <Input id={id} type="number" min={0} step="0.001" value={form.quantity} onChange={(e) => set('quantity', Number(e.target.value))} />}
        </Field>
        <Field label={t('Minimum stock')} hint={t('A LOW STOCK alert fires at or below this.')} error={errors.minimumQuantity}>
          {(id) => <Input id={id} type="number" min={0} step="0.001" value={form.minimumQuantity} onChange={(e) => set('minimumQuantity', Number(e.target.value))} />}
        </Field>
        <Field label={t('Supplier')} error={errors.supplier} className="sm:col-span-2">
          {(id) => <Input id={id} value={form.supplier ?? ''} onChange={(e) => set('supplier', e.target.value)} />}
        </Field>
        <Field label={t('Purchase price (per unit)')} error={errors.purchasePrice}>
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={form.purchasePrice} onChange={(e) => set('purchasePrice', Number(e.target.value))} />}
        </Field>
        <Field label={t('Selling price (optional)')} error={errors.sellingPrice}>
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={form.sellingPrice ?? ''} onChange={(e) => set('sellingPrice', e.target.value === '' ? null : Number(e.target.value))} />}
        </Field>
      </form>
    </Modal>
  )
}

/** English source texts, shown through t(). */
const movementCopy: Record<InventoryTransactionType, { title: string; label: string; action: string }> = {
  StockIn: { title: 'Receive stock', label: 'Quantity received', action: 'Add to stock' },
  StockOut: { title: 'Use / remove stock', label: 'Quantity used or wasted', action: 'Remove from stock' },
  Adjustment: { title: 'Stock count', label: 'Counted quantity', action: 'Set quantity' },
}

function MovementModal({ movement, onClose, onSaved }: { movement: { item: InventoryItem; type: InventoryTransactionType } | null; onClose: () => void; onSaved: (item: InventoryItem) => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const copy = movement ? movementCopy[movement.type] : movementCopy.StockIn

  const close = () => {
    setQuantity('')
    setNote('')
    onClose()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!movement) return
    setSaving(true)
    try {
      const updated = await inventoryApi.move(movement.item.id, { type: movement.type, quantity: Number(quantity), note: note.trim() || null })
      toast.success(t('{name}: {quantity} {unit} in stock', { name: updated.name, quantity: formatNumber(updated.quantity, 2), unit: updated.unit }))
      setQuantity('')
      setNote('')
      onSaved(updated)
    } catch (err) {
      toast.error(t('Could not update stock'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!movement}
      onClose={close}
      title={t(copy.title)}
      description={movement && t('{name} · currently {quantity} {unit}', { name: movement.item.name, quantity: formatNumber(movement.item.quantity, 2), unit: movement.item.unit })}
      size="sm"
      footer={<><Button variant="secondary" onClick={close}>{t('Cancel')}</Button><Button type="submit" form="move-form" loading={saving} disabled={quantity === ''}>{t(copy.action)}</Button></>}
    >
      <form id="move-form" onSubmit={submit} className="space-y-4">
        <Field label={`${t(copy.label)} (${movement?.item.unit ?? ''})`}>
          {(id) => <Input id={id} type="number" min={0} step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
        </Field>
        <Field label={t('Note')}>
          {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Invoice number, reason…')} />}
        </Field>
      </form>
    </Modal>
  )
}

function HistoryModal({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const { t } = useI18n()
  const { data, loading } = useAsync((signal) => (item ? inventoryApi.transactions(item.id, signal) : Promise.resolve([])), [item?.id])
  return (
    <Modal open={!!item} onClose={onClose} title={t('Stock history')} description={item?.name}>
      {loading && !data ? (
        <LoadingState />
      ) : !data?.length ? (
        <p className="py-6 text-center text-sm text-muted">{t('No movements yet.')}</p>
      ) : (
        <ul className="-my-2 divide-y divide-line">
          {data.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                {/* Notes written by the system ("Opening stock", "Edited quantity") are translated; typed notes stay as they are. */}
                <p className="font-medium">{inventoryMoveLabel(tx.type)}{tx.note && <span className="font-normal text-muted"> · {t(tx.note)}</span>}</p>
                <p className="text-xs text-muted">{formatDateTime(tx.createdAt)}</p>
              </div>
              <p className={cn('font-semibold tabular-nums', tx.quantityChange < 0 && 'text-danger')}>
                {tx.quantityChange > 0 ? '+' : ''}{formatNumber(tx.quantityChange, 3)}
              </p>
              <p className="w-20 text-right text-muted tabular-nums">→ {formatNumber(tx.quantityAfter, 3)}</p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
