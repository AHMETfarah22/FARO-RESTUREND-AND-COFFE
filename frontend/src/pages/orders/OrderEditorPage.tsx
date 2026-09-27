import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ProductImage } from '@/components/ProductImage'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { tableStatusLabel } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { categoriesApi, customersApi, ordersApi, productsApi, tablesApi } from '@/lib/endpoints'
import type { Product } from '@/types/api'

interface CartLine {
  key: string
  product: Pick<Product, 'id' | 'name' | 'price'>
  quantity: number
  notes: string
}

/** Point-of-sale screen for waiters: create a new order or edit one that hasn't reached the kitchen yet. */
export function OrderEditorPage() {
  const { id } = useParams()
  const isEdit = !!id
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { money, restaurant } = useRestaurant()
  const { t } = useI18n()

  const products = useAsync((signal) => productsApi.list({ available: true }, signal))
  const categories = useAsync((signal) => categoriesApi.list(signal))
  const tables = useAsync((signal) => tablesApi.list(signal))
  const customers = useAsync((signal) => customersApi.list({ pageSize: 100 }, signal))
  const existing = useAsync((signal) => (id ? ordersApi.get(id, signal) : Promise.resolve(null)), [id])

  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [tableId, setTableId] = useState(params.get('tableId') ?? '')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Load an existing order into the editor once.
  useEffect(() => {
    const order = existing.data
    if (!order || loaded) return
    setLoaded(true)
    setTableId(order.tableId ?? '')
    setCustomerId(order.customerId ?? '')
    setCustomerName(order.customerId ? '' : order.customerName ?? '')
    setNotes(order.notes ?? '')
    setDiscount(order.discount)
    setLines(
      order.items
        .filter((i) => i.productId)
        .map((i) => ({ key: i.id, product: { id: i.productId!, name: i.productName, price: i.unitPrice }, quantity: i.quantity, notes: i.notes ?? '' })),
    )
  }, [existing.data, loaded])

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (products.data ?? []).filter(
      (p) => (category === 'all' || p.categoryId === category) && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)),
    )
  }, [products.data, category, search])

  const icons = useMemo(() => new Map(categories.data?.map((c) => [c.id, c.icon]) ?? []), [categories.data])

  const add = (p: Product) =>
    setLines((ls) => {
      const existingLine = ls.find((l) => l.product.id === p.id && !l.notes)
      if (existingLine) return ls.map((l) => (l === existingLine ? { ...l, quantity: Math.min(99, l.quantity + 1) } : l))
      return [...ls, { key: `${p.id}-${Date.now()}-${Math.random()}`, product: p, quantity: 1, notes: '' }]
    })

  const update = (key: string, patch: Partial<CartLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key))

  const taxRate = existing.data?.taxRate ?? restaurant?.taxRate ?? 0
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0)
  const appliedDiscount = Math.min(discount || 0, subtotal)
  const tax = Math.round((subtotal - appliedDiscount) * taxRate) / 100
  const total = subtotal - appliedDiscount + tax

  const submit = async () => {
    setSaving(true)
    const input = {
      tableId: tableId || null,
      customerId: customerId || null,
      customerName: customerId ? null : customerName.trim() || null,
      notes: notes.trim() || null,
      discount: appliedDiscount,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, notes: l.notes.trim() || null })),
    }
    try {
      const order = isEdit ? await ordersApi.update(id!, input) : await ordersApi.create(input)
      toast.success(isEdit ? t('Order #{number} updated', { number: order.number }) : t('Order #{number} sent to the kitchen', { number: order.number }))
      navigate(`/orders/${order.id}`)
    } catch (err) {
      toast.error(t('Could not save the order'), getErrorMessage(err))
      setSaving(false)
    }
  }

  if (existing.error) return <ErrorState message={existing.error} onRetry={existing.reload} />
  if (isEdit && !existing.data) return <LoadingState />
  if (isEdit && existing.data && !['Pending', 'Confirmed'].includes(existing.data.status))
    return <ErrorState message={t('This order is already being prepared and can no longer be edited.')} />

  return (
    <>
      <PageHeader
        title={isEdit ? t('Edit order #{number}', { number: existing.data?.number ?? '' }) : t('New order')}
        description={t('Tap products to add them. Staff orders go straight to the kitchen.')}
        back={{ to: isEdit ? `/orders/${id}` : '/orders', label: isEdit ? t('Back to order') : t('Orders') }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Product picker */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder={t('Search products…')} />
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[{ id: 'all', name: t('All'), icon: '' }, ...(categories.data ?? [])].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'h-10 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
                    category === c.id ? 'border-brand bg-brand text-brand-fg' : 'border-line bg-paper text-ink hover:border-brand/40',
                  )}
                >
                  {c.icon ? `${c.icon} ` : ''}{c.name}
                </button>
              ))}
            </div>
          </div>
          {products.loading && !products.data ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((p) => {
                const soldOut = p.stock !== null && p.stock <= 0
                const inCart = lines.filter((l) => l.product.id === p.id).reduce((s, l) => s + l.quantity, 0)
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={soldOut}
                    onClick={() => add(p)}
                    className={cn(
                      'group relative flex flex-col overflow-hidden rounded-2xl border bg-paper text-left transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50',
                      inCart ? 'border-ink' : 'border-line',
                    )}
                  >
                    <ProductImage src={p.imageUrl} name={p.name} icon={icons.get(p.categoryId)} width={260} zoom className="aspect-[4/3] w-full text-xl" />
                    {inCart > 0 && <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-fg">{inCart}</span>}
                    <span className="block p-3">
                      <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                      <span className="mt-0.5 flex items-center justify-between text-sm">
                        <span className="font-semibold tabular-nums">{money(p.price)}</span>
                        {soldOut && <span className="text-xs text-danger">{t('Sold out')}</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
              {visibleProducts.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted">{t('No products match.')}</p>}
            </div>
          )}
        </div>

        {/* Cart */}
        <Card className="h-fit lg:sticky lg:top-24">
          <div className="grid grid-cols-2 gap-3 border-b border-line p-5">
            <Field label={t('Table')}>
              {(fid) => (
                <Select id={fid} value={tableId} onChange={(e) => setTableId(e.target.value)}>
                  <option value="">{t('Takeaway')}</option>
                  {tables.data?.filter((tb) => tb.status !== 'Disabled').map((tb) => (
                    <option key={tb.id} value={tb.id}>{tb.name} · {tableStatusLabel(tb.status)}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('Customer')}>
              {(fid) => (
                <Select id={fid} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('Walk-in')}</option>
                  {customers.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </Field>
            {!customerId && (
              <Field label="Guest name (optional)" className="col-span-2">
                {(fid) => <Input id={fid} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />}
              </Field>
            )}
          </div>

          <div className="max-h-[42vh] overflow-y-auto">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center text-sm text-muted">
                <ShoppingBag className="mb-3 size-8" /> {t('No items yet')}
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {lines.map((l) => (
                  <li key={l.key} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{l.product.name}</p>
                        <p className="text-xs text-muted tabular-nums">{money(l.product.price)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => (l.quantity > 1 ? update(l.key, { quantity: l.quantity - 1 }) : removeLine(l.key))} className="flex size-8 items-center justify-center rounded-lg border border-line hover:bg-surface" aria-label={t('Decrease quantity')}>
                          {l.quantity > 1 ? <Minus className="size-3.5" /> : <Trash2 className="size-3.5" />}
                        </button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                        <button type="button" onClick={() => update(l.key, { quantity: Math.min(99, l.quantity + 1) })} className="flex size-8 items-center justify-center rounded-lg border border-line hover:bg-surface" aria-label={t('Increase quantity')}>
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <p className="w-20 text-right text-sm font-semibold tabular-nums">{money(l.product.price * l.quantity)}</p>
                    </div>
                    <input
                      value={l.notes}
                      onChange={(e) => update(l.key, { notes: e.target.value })}
                      placeholder={t('Add note (e.g. no sugar)')}
                      maxLength={200}
                      className="mt-2 h-8 w-full rounded-lg border border-transparent bg-surface px-2.5 text-xs placeholder:text-muted/70 focus:border-ink focus:outline-none"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-line p-5">
            <Field label={t('Order note')}>
              {(fid) => <Textarea id={fid} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-0" />}
            </Field>
            <Field label={t('Discount')}>
              {(fid) => <Input id={fid} type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />}
            </Field>
            <dl className="space-y-1.5 pt-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t('Subtotal')}</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
              {appliedDiscount > 0 && <div className="flex justify-between"><dt className="text-muted">{t('Discount')}</dt><dd className="tabular-nums">−{money(appliedDiscount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">{t('Tax ({rate}%)', { rate: taxRate })}</dt><dd className="tabular-nums">{money(tax)}</dd></div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>{t('Total')}</dt><dd className="tabular-nums">{money(total)}</dd></div>
            </dl>
            <Button size="lg" className="w-full" disabled={lines.length === 0} loading={saving} onClick={submit}>
              {isEdit ? t('Save changes') : t('Send to kitchen')}
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
