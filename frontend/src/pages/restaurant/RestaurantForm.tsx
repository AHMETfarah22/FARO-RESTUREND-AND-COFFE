import { useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { useToast } from '@/components/ui/Toast'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { restaurantApi, type RestaurantInput } from '@/lib/endpoints'
import { sizedImage } from '@/lib/images'
import type { Restaurant } from '@/types/api'

const currencies = ['TRY', 'EUR', 'USD', 'GBP']

type Section = 'all' | 'tax'

/** Edits restaurant information. `section="tax"` shows only tax & currency (used in Settings). */
export function RestaurantForm({ restaurant, section = 'all', disabled }: { restaurant: Restaurant; section?: Section; disabled?: boolean }) {
  const toast = useToast()
  const { setRestaurant } = useRestaurant()
  const [form, setForm] = useState<RestaurantInput>({
    name: restaurant.name,
    logoUrl: restaurant.logoUrl,
    coverImageUrl: restaurant.coverImageUrl,
    phone: restaurant.phone,
    email: restaurant.email,
    address: restaurant.address,
    description: restaurant.description,
    openingTime: restaurant.openingTime,
    closingTime: restaurant.closingTime,
    currency: restaurant.currency,
    taxRate: restaurant.taxRate,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof RestaurantInput>(key: K, value: RestaurantInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const text = (key: keyof RestaurantInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(key, (e.target.value || null) as never)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const updated = await restaurantApi.update(restaurant.id, { ...form, name: form.name.trim() })
      setRestaurant(updated)
      toast.success('Restaurant updated')
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error('Could not save', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset disabled={disabled} className="space-y-5">
        {section === 'all' && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Restaurant name" error={errors.name} required className="sm:col-span-2">
                {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} />}
              </Field>
              <Field label="Phone" error={errors.phone}>
                {(id) => <Input id={id} type="tel" value={form.phone ?? ''} onChange={text('phone')} />}
              </Field>
              <Field label="Email" error={errors.email}>
                {(id) => <Input id={id} type="email" value={form.email ?? ''} onChange={text('email')} invalid={!!errors.email} />}
              </Field>
              <Field label="Address" error={errors.address} className="sm:col-span-2">
                {(id) => <Input id={id} value={form.address ?? ''} onChange={text('address')} />}
              </Field>
              <Field label="Opening time" error={errors.openingTime}>
                {(id) => <Input id={id} type="time" value={form.openingTime} onChange={(e) => set('openingTime', e.target.value)} />}
              </Field>
              <Field label="Closing time" error={errors.closingTime}>
                {(id) => <Input id={id} type="time" value={form.closingTime} onChange={(e) => set('closingTime', e.target.value)} />}
              </Field>
              <Field label="Logo URL" hint="Optional. The text logo is used when empty." error={errors.logoUrl} className="sm:col-span-2">
                {(id) => <Input id={id} type="url" value={form.logoUrl ?? ''} onChange={text('logoUrl')} placeholder="https://…" />}
              </Field>
              <Field label="Cover photo URL" hint="Wide photo shown on the QR menu, login page and dashboard." error={errors.coverImageUrl} className="sm:col-span-2">
                {(id) => (
                  <div className="space-y-3">
                    <Input id={id} type="url" value={form.coverImageUrl ?? ''} onChange={text('coverImageUrl')} placeholder="https://…" invalid={!!errors.coverImageUrl} />
                    {form.coverImageUrl && (
                      <img src={sizedImage(form.coverImageUrl, 800) ?? form.coverImageUrl} alt="Cover preview" className="aspect-[3/1] w-full rounded-xl object-cover" />
                    )}
                  </div>
                )}
              </Field>
              <Field label="Description" error={errors.description} className="sm:col-span-2">
                {(id) => <Textarea id={id} value={form.description ?? ''} onChange={text('description')} rows={3} />}
              </Field>
            </div>
          </>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Currency" error={errors.currency}>
            {(id) => (
              <Select id={id} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tax rate (%)" hint="Applied to new orders after discounts." error={errors.taxRate}>
            {(id) => (
              <Input id={id} type="number" min={0} max={100} step="0.01" value={form.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
            )}
          </Field>
        </div>
      </fieldset>

      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" loading={saving} icon={<Save className="size-4" />}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  )
}
