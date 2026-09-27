import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Field, Input, Switch, Textarea } from '@/components/ui/Form'
import { DataTable, PageHeader, td, th } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { categoriesApi, type CategoryInput } from '@/lib/endpoints'
import type { Category } from '@/types/api'

const iconSuggestions = ['☕', '🍳', '🍔', '🍕', '🍽️', '🍰', '🥤', '🍵', '🥗', '🍝', '🥐', '🍦']

export function CategoriesPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { t } = useI18n()
  const confirm = useConfirm()
  const { data, error, loading, reload, setData } = useAsync((signal) => categoriesApi.list(signal))
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const canManage = can('menuManage')

  const remove = async (category: Category) => {
    if (!(await confirm({ title: t('Delete "{name}"?', { name: category.name }), message: t('Only empty categories can be deleted.'), confirmLabel: t('Delete'), danger: true }))) return
    try {
      await categoriesApi.remove(category.id)
      setData((list) => list!.filter((c) => c.id !== category.id))
      toast.success(t('Category deleted'))
    } catch (err) {
      toast.error(t('Could not delete the category'), getErrorMessage(err))
    }
  }

  const toggleActive = async (category: Category) => {
    try {
      const updated = await categoriesApi.update(category.id, { ...category, isActive: !category.isActive })
      setData((list) => list!.map((c) => (c.id === updated.id ? updated : c)))
    } catch (err) {
      toast.error(t('Could not update the category'), getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t('Categories')}
        description={t('Sections of your menu. Hidden categories are not shown on the QR menu.')}
        actions={canManage && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>{t('Add category')}</Button>}
      />
      <Card>
        <AsyncBlock
          data={data}
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title={t('No categories yet')} description={t('Create categories such as Coffee, Breakfast or Desserts.')} />}
        >
          {(categories) => (
            <DataTable
              head={
                <tr>
                  <th className={th}>{t('Category')}</th>
                  <th className={th}>{t('Products')}</th>
                  <th className={th}>{t('Sort order')}</th>
                  <th className={th}>{t('Visible on menu')}</th>
                  {canManage && <th className={`${th} text-right`}>{t('Actions')}</th>}
                </tr>
              }
            >
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-surface/50">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-xl">{c.icon || '•'}</span>
                      <div>
                        <p className="font-medium text-ink">{c.name}</p>
                        {c.description && <p className="max-w-xs truncate text-xs text-muted">{c.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <Link to={`/products?category=${c.id}`} className="underline-offset-4 hover:underline">{c.productCount}</Link>
                  </td>
                  <td className={td}>{c.sortOrder}</td>
                  <td className={td}>
                    {canManage ? (
                      <Switch checked={c.isActive} onChange={() => toggleActive(c)} />
                    ) : (
                      <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t('Visible') : t('Hidden')}</Badge>
                    )}
                  </td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      <div className="inline-flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)} aria-label={t('Edit {name}', { name: c.name })}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => remove(c)} aria-label={t('Delete {name}', { name: c.name })} className="text-danger hover:bg-danger/5"><Trash2 className="size-4" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </DataTable>
          )}
        </AsyncBlock>
      </Card>

      <CategoryModal
        category={editing}
        nextSort={(data?.length ?? 0)}
        onClose={() => setEditing(null)}
        onSaved={(saved) => {
          setData((list) => {
            const next = list?.some((c) => c.id === saved.id) ? list.map((c) => (c.id === saved.id ? saved : c)) : [...(list ?? []), saved]
            return next.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
          })
          setEditing(null)
        }}
      />
    </>
  )
}

function CategoryModal({ category, nextSort, onClose, onSaved }: { category: Category | 'new' | null; nextSort: number; onClose: () => void; onSaved: (c: Category) => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = category === 'new'
  const initial: CategoryInput =
    category && category !== 'new'
      ? { name: category.name, description: category.description, icon: category.icon, sortOrder: category.sortOrder, isActive: category.isActive }
      : { name: '', description: null, icon: '☕', sortOrder: nextSort, isActive: true }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = category === null ? null : isNew ? 'new' : category.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setErrors({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input = { ...form, name: form.name.trim(), description: form.description?.trim() || null, icon: form.icon?.trim() || null }
      const saved = isNew ? await categoriesApi.create(input) : await categoriesApi.update((category as Category).id, input)
      toast.success(isNew ? t('Category created') : t('Category updated'))
      onSaved(saved)
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save the category'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={category !== null}
      onClose={onClose}
      title={isNew ? t('Add category') : t('Edit category')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="category-form" loading={saving}>{t('Save')}</Button></>}
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('Name')} error={errors.name} required>
          {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name} placeholder={t('e.g. Coffee')} />}
        </Field>
        <Field label={t('Icon')} hint={t('An emoji shown on the QR menu.')} error={errors.icon}>
          {(id) => (
            <div className="space-y-2">
              <Input id={id} value={form.icon ?? ''} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="w-24 text-center text-xl" maxLength={4} />
              <div className="flex flex-wrap gap-1.5">
                {iconSuggestions.map((icon) => (
                  <button key={icon} type="button" onClick={() => setForm({ ...form, icon })} className={`size-9 rounded-lg border text-lg ${form.icon === icon ? 'border-ink bg-surface' : 'border-line hover:border-ink/40'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>
        <Field label={t('Description')} error={errors.description}>
          {(id) => <Textarea id={id} rows={2} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <Field label={t('Sort order')} hint={t('Lower numbers appear first.')} error={errors.sortOrder}>
          {(id) => <Input id={id} type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} className="w-32" />}
        </Field>
        <Switch checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('Visible on menu')} description={t('Hidden categories stay available to staff.')} />
      </form>
    </Modal>
  )
}
