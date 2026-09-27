import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { customersApi, type CustomerInput } from '@/lib/endpoints'
import type { Customer } from '@/types/api'

export function CustomerFormModal({ customer, onClose, onSaved }: { customer: Customer | 'new' | null; onClose: () => void; onSaved: (c: Customer) => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = customer === 'new'
  const initial: CustomerInput =
    customer && customer !== 'new'
      ? { name: customer.name, phone: customer.phone, email: customer.email, notes: customer.notes }
      : { name: '', phone: null, email: null, notes: null }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = customer === null ? null : isNew ? 'new' : customer.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setErrors({})
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input = { name: form.name.trim(), phone: form.phone?.trim() || null, email: form.email?.trim() || null, notes: form.notes?.trim() || null }
      const saved = isNew ? await customersApi.create(input) : await customersApi.update((customer as Customer).id, input)
      toast.success(isNew ? t('Customer added') : t('Customer updated'))
      onSaved(saved)
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save the customer'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={customer !== null}
      onClose={onClose}
      title={isNew ? t('Add customer') : t('Edit customer')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="customer-form" loading={saving}>{t('Save')}</Button></>}
    >
      <form id="customer-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label={t('Name')} error={errors.name} required>
          {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name} />}
        </Field>
        <Field label={t('Phone')} error={errors.phone}>
          {(id) => <Input id={id} type="tel" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} invalid={!!errors.phone} />}
        </Field>
        <Field label={t('Email')} error={errors.email}>
          {(id) => <Input id={id} type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={!!errors.email} />}
        </Field>
        <Field label={t('Notes')} hint={t('Preferences, allergies, VIP…')} error={errors.notes}>
          {(id) => <Textarea id={id} rows={3} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  )
}
