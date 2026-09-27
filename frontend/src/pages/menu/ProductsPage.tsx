import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Clock, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ProductImage } from '@/components/ProductImage'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/Form'
import { PageHeader, SearchInput } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { AsyncBlock, EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { categoriesApi, productsApi, type ProductInput } from '@/lib/endpoints'
import type { Category, Product } from '@/types/api'

export function ProductsPage() {
  const { can } = useAuth()
  const { money } = useRestaurant()
  const toast = useToast()
  const { t } = useI18n()
  const confirm = useConfirm()
  const [params, setParams] = useSearchParams()
  const categoryId = params.get('category') ?? ''
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const canManage = can('menuManage')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search])

  const categories = useAsync((signal) => categoriesApi.list(signal))
  const { data, error, loading, reload, setData } = useAsync(
    (signal) => productsApi.list({ search: debounced || undefined, categoryId: categoryId || undefined }, signal),
    [debounced, categoryId],
  )

  const categoryIcons = useMemo(() => new Map(categories.data?.map((c) => [c.id, c.icon]) ?? []), [categories.data])

  const patch = async (product: Product, changes: Partial<ProductInput>) => {
    try {
      const updated = await productsApi.update(product.id, { ...toInput(product), ...changes })
      setData((list) => list!.map((p) => (p.id === updated.id ? updated : p)))
    } catch (err) {
      toast.error(t('Could not update the product'), getErrorMessage(err))
    }
  }

  const remove = async (product: Product) => {
    if (!(await confirm({ title: t('Delete "{name}"?', { name: product.name }), message: t('Past orders keep the product name and price.'), confirmLabel: t('Delete'), danger: true }))) return
    try {
      await productsApi.remove(product.id)
      setData((list) => list!.filter((p) => p.id !== product.id))
      toast.success(t('Product deleted'))
    } catch (err) {
      toast.error(t('Could not delete the product'), getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t('Products')}
        description={t('Everything on your menu — prices, stock and availability.')}
        actions={canManage && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>{t('Add product')}</Button>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder={t('Search by name or SKU…')} className="sm:max-w-xs sm:flex-1" />
        <Select
          value={categoryId}
          onChange={(e) => setParams(e.target.value ? { category: e.target.value } : {})}
          className="sm:w-56"
          aria-label={t('Filter by category')}
        >
          <option value="">{t('All categories')}</option>
          {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </Select>
      </div>

      <AsyncBlock
        data={data}
        loading={loading}
        error={error}
        onRetry={reload}
        skeleton={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>}
        isEmpty={(d) => d.length === 0}
        empty={<Card><EmptyState title={t('No products found')} description={debounced || categoryId ? t('Try another search or category.') : t('Add your first product to the menu.')} /></Card>}
      >
        {(products) => (
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => (
              <Card key={p.id} className={cn('group flex flex-col overflow-hidden', !p.isAvailable && 'opacity-70')}>
                <div className="relative">
                  <ProductImage src={p.imageUrl} name={p.name} icon={categoryIcons.get(p.categoryId)} width={480} zoom className="aspect-[16/10] w-full text-2xl" />
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {p.isFeatured && <Badge tone="dark"><Star className="size-3 fill-current" /> {t('Featured')}</Badge>}
                    {!p.isAvailable && <Badge tone="neutral">{t('Unavailable')}</Badge>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-muted">{p.categoryName} · {p.sku}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-ink tabular-nums">{money(p.price)}</p>
                  </div>
                  {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {p.preparationMinutes} min</span>
                    <span className={cn(p.stock !== null && p.stock <= 5 && 'font-semibold text-warning')}>
                      {p.stock === null ? t('Stock not tracked') : t('{n} in stock', { n: p.stock })}
                    </span>
                  </div>
                  {canManage && (
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
                      <Switch checked={p.isAvailable} onChange={(v) => patch(p, { isAvailable: v })} label={<span className="text-xs">{t('Available')}</span>} />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => patch(p, { isFeatured: !p.isFeatured })} aria-label={p.isFeatured ? t('Remove from featured') : t('Add to featured')}>
                          <Star className={cn('size-4', p.isFeatured && 'fill-current')} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label={t('Edit {name}', { name: p.name })}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(p)} aria-label={t('Delete {name}', { name: p.name })} className="text-danger hover:bg-danger/5"><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </AsyncBlock>

      <ProductModal
        product={editing}
        categories={categories.data ?? []}
        defaultCategoryId={categoryId}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />
    </>
  )
}

function toInput(p: Product): ProductInput {
  return {
    categoryId: p.categoryId,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    sku: p.sku,
    stock: p.stock,
    isAvailable: p.isAvailable,
    isFeatured: p.isFeatured,
    preparationMinutes: p.preparationMinutes,
    images: p.images,
  }
}

function ProductModal({
  product,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  product: Product | 'new' | null
  categories: Category[]
  defaultCategoryId: string
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = product === 'new'
  const initial: ProductInput =
    product && product !== 'new'
      ? toInput(product)
      : {
          categoryId: defaultCategoryId || categories[0]?.id || '',
          name: '',
          description: null,
          imageUrl: null,
          price: 0,
          sku: '',
          stock: null,
          isAvailable: true,
          isFeatured: false,
          preparationMinutes: 10,
          images: [],
        }
  const [form, setForm] = useState(initial)
  const [trackStock, setTrackStock] = useState(initial.stock !== null)
  const [newImage, setNewImage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = product === null ? null : isNew ? 'new' : product.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setTrackStock(initial.stock !== null)
    setErrors({})
    setNewImage('')
  }

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: ProductInput = {
        ...form,
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description?.trim() || null,
        imageUrl: form.imageUrl?.trim() || null,
        stock: trackStock ? (form.stock ?? 0) : null,
      }
      if (isNew) await productsApi.create(input)
      else await productsApi.update((product as Product).id, input)
      toast.success(isNew ? t('Product created') : t('Product updated'))
      onSaved()
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save the product'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={product !== null}
      onClose={onClose}
      title={isNew ? t('Add product') : t('Edit product')}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="product-form" loading={saving}>{t('Save product')}</Button></>}
    >
      <form id="product-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('Name')} error={errors.name} required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} placeholder={t('e.g. Cappuccino')} />}
        </Field>
        <Field label={t('Category')} error={errors.categoryId} required>
          {(id) => (
            <Select id={id} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t('SKU')} hint={t('Unique code, e.g. COF-101')} error={errors.sku} required>
          {(id) => <Input id={id} value={form.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} invalid={!!errors.sku} />}
        </Field>
        <Field label={t('Price')} error={errors.price} required>
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={form.price} onChange={(e) => set('price', Number(e.target.value))} invalid={!!errors.price} />}
        </Field>
        <Field label={t('Preparation time (min)')} error={errors.preparationMinutes}>
          {(id) => <Input id={id} type="number" min={0} max={240} value={form.preparationMinutes} onChange={(e) => set('preparationMinutes', Number(e.target.value))} />}
        </Field>
        <Field label={t('Description')} error={errors.description} className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder={t('Espresso, steamed milk and milk foam')} />}
        </Field>

        <Field label={t('Main image URL')} hint={t('Paste an image link (https://…).')} error={errors.imageUrl} className="sm:col-span-2">
          {(id) => (
            <div className="flex gap-3">
              <Input id={id} type="url" value={form.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value)} invalid={!!errors.imageUrl} className="flex-1" />
              <ProductImage src={form.imageUrl || null} name={form.name || '?'} className="size-11 shrink-0 rounded-xl text-sm" />
            </div>
          )}
        </Field>
        <Field label={t('Additional images')} error={errors.images} className="sm:col-span-2">
          {(id) => (
            <div className="space-y-2">
              {form.images.map((url) => (
                <div key={url} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <ProductImage src={url} name="" className="size-8 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1 truncate">{url}</span>
                  <button type="button" onClick={() => set('images', form.images.filter((u) => u !== url))} className="text-muted hover:text-danger" aria-label={t('Remove image')}><X className="size-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input id={id} type="url" value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder="https://…" className="flex-1" />
                <Button variant="secondary" disabled={!newImage.trim()} onClick={() => { set('images', [...form.images, newImage.trim()]); setNewImage('') }}>{t('Add')}</Button>
              </div>
            </div>
          )}
        </Field>

        <div className="space-y-3 rounded-xl border border-line p-4 sm:col-span-2">
          <Checkbox checked={trackStock} onChange={setTrackStock} label={t('Track stock for this product')} />
          {trackStock && (
            <Field label={t('Portions in stock')} error={errors.stock}>
              {(id) => <Input id={id} type="number" min={0} value={form.stock ?? 0} onChange={(e) => set('stock', Number(e.target.value))} className="w-40" />}
            </Field>
          )}
        </div>
        <div className="space-y-4 sm:col-span-2">
          <Switch checked={form.isAvailable} onChange={(v) => set('isAvailable', v)} label={t('Available')} description={t('Unavailable products are hidden from the QR menu.')} />
          <Switch checked={form.isFeatured} onChange={(v) => set('isFeatured', v)} label={t('Featured')} description={t('Shown first and highlighted on the QR menu.')} />
        </div>
      </form>
    </Modal>
  )
}
