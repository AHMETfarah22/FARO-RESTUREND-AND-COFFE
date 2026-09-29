import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, Minus, Save } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Checkbox, Field, Input, Switch } from '@/components/ui/Form'
import { DataTable, PageHeader, td, th } from '@/components/ui/Layout'
import { AsyncBlock, LoadingState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { isDemo } from '@/config/env'
import { useAuth } from '@/features/auth/AuthContext'
import { useRestaurant } from '@/features/restaurant/RestaurantContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { cn } from '@/lib/cn'
import { accountApi, licenseApi, restaurantApi } from '@/lib/endpoints'
import { formatDateOnly, formatDateTime } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { roleLabel } from '@/lib/labels'
import { permissions, type Permission } from '@/lib/permissions'
import type { PaymentMethod, RestaurantSettings, Role } from '@/types/api'
import { RestaurantForm } from '../restaurant/RestaurantForm'

const tabs = [
  { key: 'restaurant', label: 'Restaurant Information' },
  { key: 'profile', label: 'Profile' },
  { key: 'users', label: 'Users' },
  { key: 'roles', label: 'Roles' },
  { key: 'tax', label: 'Tax & Currency' },
  { key: 'orders', label: 'Order Settings' },
  { key: 'notifications', label: 'Notification Settings' },
  { key: 'qr', label: 'QR Settings' },
  { key: 'payments', label: 'Payment Settings' },
  { key: 'system', label: 'System Settings' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (tabs.find((t) => t.key === params.get('tab'))?.key ?? 'restaurant') as TabKey

  return (
    <>
      <PageHeader title="Settings" description="Configure your restaurant, account and system." />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Settings sections">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setParams({ tab: t.key })}
              className={cn(
                'shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors',
                tab === t.key ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-paper hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === 'restaurant' && <RestaurantSection />}
          {tab === 'profile' && <ProfileSection />}
          {tab === 'users' && <UsersSection />}
          {tab === 'roles' && <RolesSection />}
          {tab === 'tax' && <RestaurantSection section="tax" />}
          {tab === 'orders' && <OperationalSection kind="orders" />}
          {tab === 'notifications' && <OperationalSection kind="notifications" />}
          {tab === 'qr' && <OperationalSection kind="qr" />}
          {tab === 'payments' && <OperationalSection kind="payments" />}
          {tab === 'system' && <SystemSection />}
        </div>
      </div>
    </>
  )
}

function ReadOnlyNote() {
  return <p className="mb-4 rounded-xl bg-surface px-4 py-3 text-sm text-muted">Only restaurant administrators can change these settings.</p>
}

function RestaurantSection({ section = 'all' }: { section?: 'all' | 'tax' }) {
  const { restaurant } = useRestaurant()
  const { can } = useAuth()
  if (!restaurant) return <LoadingState />
  return (
    <Card>
      <CardHeader
        title={section === 'tax' ? 'Tax & currency' : 'Restaurant information'}
        description={section === 'tax' ? 'Used for new orders, receipts and reports.' : 'Name, contact details and opening hours.'}
      />
      <div className="p-6">
        {!can('restaurantSettings') && <ReadOnlyNote />}
        <RestaurantForm key={`${restaurant.id}-${section}`} restaurant={restaurant} section={section} disabled={!can('restaurantSettings')} />
      </div>
    </Card>
  )
}

function ProfileSection() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({})
  const [changing, setChanging] = useState(false)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      updateUser(await accountApi.updateProfile({ fullName: fullName.trim(), phone: phone.trim() || null }))
      toast.success('Profile updated')
    } catch (err) {
      toast.error('Could not save profile', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.next !== pw.confirm) {
      setPwErrors({ confirm: 'Passwords do not match.' })
      return
    }
    setChanging(true)
    setPwErrors({})
    try {
      await accountApi.changePassword({ currentPassword: pw.current, newPassword: pw.next })
      toast.success('Password changed', 'Please sign in again with your new password.')
      setPw({ current: '', next: '', confirm: '' })
    } catch (err) {
      const fields = getFieldErrors(err)
      setPwErrors({ current: fields.currentPassword, next: fields.newPassword })
      if (!fields.currentPassword && !fields.newPassword) toast.error('Could not change password', getErrorMessage(err))
    } finally {
      setChanging(false)
    }
  }

  if (!user) return null
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Profile" description={`${user.email} · ${user.roles.map((r) => roleLabel(r)).join(', ')}`} />
        <form onSubmit={saveProfile} className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Full name">{(id) => <Input id={id} value={fullName} onChange={(e) => setFullName(e.target.value)} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
          <Field label="Username">{(id) => <Input id={id} value={user.userName} disabled />}</Field>
          <Field label="Email">{(id) => <Input id={id} value={user.email} disabled />}</Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" loading={saving} disabled={!fullName.trim()} icon={<Save className="size-4" />}>Save profile</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Change password" description="At least 8 characters with upper & lower case, a digit and a symbol." />
        <form onSubmit={changePassword} className="grid gap-4 p-6 sm:grid-cols-3">
          <Field label="Current password" error={pwErrors.current}>
            {(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} invalid={!!pwErrors.current} />}
          </Field>
          <Field label="New password" error={pwErrors.next}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} invalid={!!pwErrors.next} />}
          </Field>
          <Field label="Confirm new password" error={pwErrors.confirm}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} invalid={!!pwErrors.confirm} />}
          </Field>
          <div className="flex justify-end sm:col-span-3">
            <Button type="submit" loading={changing} disabled={!pw.current || !pw.next}>Change password</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function UsersSection() {
  const { can } = useAuth()
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-ink">Users</h2>
      <p className="mt-1 text-sm text-muted">
        Employee accounts (managers, waiters, kitchen staff and cashiers) are managed in Staff Management, where you can create accounts, change roles,
        deactivate users and reset passwords. Customers create their own accounts from the registration page.
      </p>
      {can('staff') ? (
        <Link to="/staff" className="mt-5 inline-block"><Button>Open Staff Management</Button></Link>
      ) : (
        <p className="mt-5 text-sm text-muted">Ask a manager to change user accounts.</p>
      )}
    </Card>
  )
}

const matrix: { label: string; permission: Permission }[] = [
  { label: 'Dashboard & analytics', permission: 'dashboard' },
  { label: 'Servis board (serve plates)', permission: 'serviceBoard' },
  { label: 'Kasa (cash desk)', permission: 'cashDesk' },
  { label: 'Restaurant & settings', permission: 'restaurantSettings' },
  { label: 'View masalar', permission: 'tablesView' },
  { label: 'Manage masalar & QR', permission: 'tablesManage' },
  { label: 'Manage menu', permission: 'menuManage' },
  { label: 'Create / update orders', permission: 'ordersCreate' },
  { label: 'Kitchen display', permission: 'kitchen' },
  { label: 'Reservations', permission: 'reservations' },
  { label: 'Customers', permission: 'customers' },
  { label: 'Staff management', permission: 'staff' },
  { label: 'Inventory', permission: 'inventory' },
  { label: 'Payments', permission: 'payments' },
  { label: 'Refunds', permission: 'refunds' },
  { label: 'Reports', permission: 'reports' },
]

const matrixRoles: Role[] = ['SuperAdmin', 'RestaurantAdmin', 'Manager', 'Waiter', 'Kitchen', 'Cashier']

function RolesSection() {
  return (
    <Card>
      <CardHeader title="Roles & permissions" description="Enforced by the API. Customers only use the QR menu and their order history." />
      <DataTable
        head={
          <tr>
            <th className={th}>Permission</th>
            {matrixRoles.map((r) => <th key={r} className={`${th} text-center`}>{roleLabel(r)}</th>)}
          </tr>
        }
      >
        {matrix.map((row) => (
          <tr key={row.permission}>
            <td className={`${td} font-medium`}>{row.label}</td>
            {matrixRoles.map((r) => (
              <td key={r} className={`${td} text-center`}>
                {(permissions[row.permission] as Role[]).includes(r) ? (
                  <Check className="mx-auto size-4 text-ink" aria-label="Allowed" />
                ) : (
                  <Minus className="mx-auto size-4 text-line" aria-label="Not allowed" />
                )}
              </td>
            ))}
          </tr>
        ))}
      </DataTable>
    </Card>
  )
}

const allMethods: PaymentMethod[] = ['Cash', 'Card', 'Online', 'Test']

function OperationalSection({ kind }: { kind: 'orders' | 'notifications' | 'qr' | 'payments' }) {
  const { restaurant, setRestaurant } = useRestaurant()
  const { can } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<RestaurantSettings | null>(restaurant?.settings ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  if (!restaurant || !form) return <LoadingState />

  const editable = can('restaurantSettings')
  const set = <K extends keyof RestaurantSettings>(k: K, v: RestaurantSettings[K]) => setForm({ ...form, [k]: v })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const updated = await restaurantApi.updateSettings(form)
      setRestaurant(updated)
      setForm(updated.settings)
      toast.success('Settings saved')
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error('Could not save settings', getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const titles = {
    orders: ['Order settings', 'How QR and staff orders flow into the kitchen.'],
    notifications: ['Notification settings', 'Real-time alerts delivered to staff.'],
    qr: ['QR settings', 'The address encoded in masa QR codes.'],
    payments: ['Payment settings', 'Test build: all payments are simulated.'],
  } as const

  let body: ReactNode
  if (kind === 'orders') {
    body = (
      <div className="space-y-5">
        <Switch checked={form.qrOrderingEnabled} onChange={(v) => set('qrOrderingEnabled', v)} disabled={!editable} label="Allow ordering from the QR menu" description="When off, guests can browse the menu but not order." />
        <Switch checked={form.autoConfirmQrOrders} onChange={(v) => set('autoConfirmQrOrders', v)} disabled={!editable} label="Auto-accept QR orders" description="Skip the Pending step — QR orders go straight to the kitchen as Confirmed." />
        <Field label="Target preparation time (minutes)" hint="Kitchen tickets are highlighted after this time." error={errors.defaultPreparationMinutes}>
          {(id) => <Input id={id} type="number" min={1} max={240} value={form.defaultPreparationMinutes} disabled={!editable} onChange={(e) => set('defaultPreparationMinutes', Number(e.target.value))} className="w-32" />}
        </Field>
      </div>
    )
  } else if (kind === 'notifications') {
    body = (
      <div className="space-y-5">
        <Switch checked={form.newOrderSound} onChange={(v) => set('newOrderSound', v)} disabled={!editable} label="Sound for new orders" description="Play a chime in the portal when a new order arrives." />
        <Switch checked={form.lowStockAlerts} onChange={(v) => set('lowStockAlerts', v)} disabled={!editable} label="Low stock alerts" description="Notify when an inventory item drops to its minimum." />
        <Switch checked={form.reservationAlerts} onChange={(v) => set('reservationAlerts', v)} disabled={!editable} label="Reservation alerts" description="Notify when a new reservation is created." />
      </div>
    )
  } else if (kind === 'qr') {
    body = (
      <Field
        label="Public QR menu base URL"
        hint={`Leave empty to use this portal's address (${window.location.origin}). For phones on the same Wi-Fi use e.g. http://192.168.1.20:5173.`}
        error={errors.qrMenuBaseUrl}
      >
        {(id) => <Input id={id} type="url" value={form.qrMenuBaseUrl ?? ''} disabled={!editable} onChange={(e) => set('qrMenuBaseUrl', e.target.value || null)} placeholder="https://menu.example.com" invalid={!!errors.qrMenuBaseUrl} />}
      </Field>
    )
  } else {
    body = (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-ink">Enabled payment methods</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {allMethods.map((m) => (
              <Checkbox
                key={m}
                label={m}
                disabled={!editable}
                checked={form.enabledPaymentMethods.includes(m)}
                onChange={(on) => set('enabledPaymentMethods', on ? [...form.enabledPaymentMethods, m] : form.enabledPaymentMethods.filter((x) => x !== m))}
              />
            ))}
          </div>
          {errors.enabledPaymentMethods && <p className="mt-2 text-xs text-danger">{errors.enabledPaymentMethods}</p>}
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Payment provider</p>
            <Badge tone="warning">Test mode</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            Simulated gateway — no money is moved. The architecture exposes an <code>IPaymentGateway</code> interface so Stripe, Iyzico or another provider can be
            plugged in without changing orders or reports.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader title={titles[kind][0]} description={titles[kind][1]} />
      <form onSubmit={save} className="p-6">
        {!editable && <ReadOnlyNote />}
        {body}
        {editable && (
          <div className="mt-6 flex justify-end">
            <Button type="submit" loading={saving} icon={<Save className="size-4" />}>Save settings</Button>
          </div>
        )}
      </form>
    </Card>
  )
}

function SystemSection() {
  const { data, error, loading, reload } = useAsync((signal) => restaurantApi.health(signal))
  // The demo has no license; a real installation shows who it is licensed to and this computer's code.
  const { data: license } = useAsync((signal) => (isDemo ? Promise.resolve(null) : licenseApi.status(signal)))
  const { t } = useI18n()
  const licenseText = isDemo
    ? 'Demo'
    : license?.status === 'Active'
      ? `${t('Licensed to {name}', { name: license.customer ?? '—' })} · ${license.licenseId} · ${license.expiresOn ? t('until {date}', { date: formatDateOnly(license.expiresOn) }) : t('no expiry')}`
      : (license?.status ?? '—')

  return (
    <Card>
      <CardHeader title="System" description="Environment and service health." action={<Button variant="secondary" size="sm" onClick={reload} loading={loading}>Refresh</Button>} />
      <AsyncBlock data={data} loading={loading} error={error} onRetry={reload}>
        {(h) => (
          <dl className="divide-y divide-line text-sm">
            {[
              ['Application', h.application],
              ['Status', <Badge key="s" tone={h.status === 'Healthy' ? 'success' : 'warning'}>{h.status}</Badge>],
              [t('License'), licenseText],
              ...(license ? [[t('Machine code'), <span key="m" className="font-mono">{license.machineCode}</span>]] : []),
              ['Environment', h.environment],
              ['Database', `${h.database.provider} ${h.database.serverVersion ?? ''} · ${h.database.connected ? 'connected' : 'disconnected'}`],
              ['Pending migrations', h.database.pendingMigrations],
              ['Frontend build', import.meta.env.MODE],
              ['Server time', formatDateTime(h.serverTimeUtc)],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-6 py-3.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </AsyncBlock>
    </Card>
  )
}
