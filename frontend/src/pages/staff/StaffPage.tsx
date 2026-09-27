import { useState, type FormEvent } from 'react'
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Field, Input, Select, Switch } from '@/components/ui/Form'
import { DataTable, PageHeader, td, th } from '@/components/ui/Layout'
import { Modal } from '@/components/ui/Modal'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { staffApi, type StaffInput } from '@/lib/endpoints'
import { formatDateOnly } from '@/lib/format'
import { roleLabel } from '@/lib/labels'
import type { Role, StaffMember } from '@/types/api'

const staffRoles: Role[] = ['Manager', 'Waiter', 'Kitchen', 'Cashier']
const passwordHint = 'At least 8 characters with upper & lower case, a digit and a symbol.' // shown through t()

export function StaffPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useI18n()
  const confirm = useConfirm()
  const { data, error, loading, reload, setData } = useAsync((signal) => staffApi.list(signal))
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)
  const [resetting, setResetting] = useState<StaffMember | null>(null)

  const remove = async (s: StaffMember) => {
    if (!(await confirm({ title: t('Delete {name}?', { name: s.fullName }), message: t('Their login account is removed. Consider deactivating instead to keep the record.'), confirmLabel: t('Delete employee'), danger: true }))) return
    try {
      await staffApi.remove(s.id)
      setData((list) => list!.filter((x) => x.id !== s.id))
      toast.success(t('Employee deleted'))
    } catch (err) {
      toast.error(t('Could not delete the employee'), getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t('Staff')}
        description={t('Employee accounts and roles. Each role only sees what it needs.')}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>{t('Add employee')}</Button>}
      />
      <Card>
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload} isEmpty={(d) => d.length === 0} empty={<EmptyState title={t('No employees yet')} />}>
          {(staff) => (
            <DataTable
              head={
                <tr>
                  <th className={th}>{t('Employee')}</th>
                  <th className={th}>{t('Username')}</th>
                  <th className={th}>{t('Phone')}</th>
                  <th className={th}>{t('Role')}</th>
                  <th className={th}>{t('Status')}</th>
                  <th className={th}>{t('Hired')}</th>
                  <th className={`${th} text-right`}>{t('Actions')}</th>
                </tr>
              }
            >
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-surface/50">
                  <td className={td}>
                    <p className="font-medium text-ink">{s.fullName}{s.userId === user?.id && <span className="ml-2 text-xs text-muted">({t('you')})</span>}</p>
                    <p className="text-xs text-muted">{s.email}</p>
                  </td>
                  <td className={`${td} text-muted`}>{s.userName}</td>
                  <td className={`${td} whitespace-nowrap`}>{s.phone ?? '—'}</td>
                  <td className={td}><Badge tone="dark">{roleLabel(s.role)}</Badge></td>
                  <td className={td}><Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? t('Active') : t('Inactive')}</Badge></td>
                  <td className={`${td} text-muted`}>{formatDateOnly(s.hiredOn)}</td>
                  <td className={`${td} text-right`}>
                    <div className="inline-flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setResetting(s)} aria-label={t('Reset password')} title={t('Reset password')}><KeyRound className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label={t('Edit')}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(s)} aria-label={t('Delete')} className="text-danger" disabled={s.userId === user?.id}><Trash2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </AsyncBlock>
      </Card>

      <StaffModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />
      <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
    </>
  )
}

function StaffModal({ member, onClose, onSaved }: { member: StaffMember | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const isNew = member === 'new'
  const initial: StaffInput & { password: string } =
    member && member !== 'new'
      ? { fullName: member.fullName, email: member.email, userName: member.userName, phone: member.phone, role: member.role, isActive: member.isActive, password: '' }
      : { fullName: '', email: '', userName: '', phone: null, role: 'Waiter', isActive: true, password: '' }
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [lastKey, setLastKey] = useState<string | null>(null)
  const key = member === null ? null : isNew ? 'new' : member.id
  if (key !== lastKey) {
    setLastKey(key)
    setForm(initial)
    setErrors({})
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const base = { fullName: form.fullName.trim(), email: form.email.trim(), userName: form.userName.trim(), phone: form.phone?.trim() || null, role: form.role, isActive: form.isActive }
      if (isNew) await staffApi.create({ ...base, password: form.password })
      else await staffApi.update((member as StaffMember).id, base)
      toast.success(isNew ? t('Employee created') : t('Employee updated'))
      onSaved()
    } catch (err) {
      setErrors(getFieldErrors(err))
      toast.error(t('Could not save the employee'), getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={member !== null}
      onClose={onClose}
      title={isNew ? t('Add employee') : t('Edit employee')}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="staff-form" loading={saving}>{t('Save')}</Button></>}
    >
      <form id="staff-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label={t('Full name')} error={errors.fullName} required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} invalid={!!errors.fullName} />}
        </Field>
        <Field label={t('Email')} error={errors.email} required>
          {(id) => (
            <Input
              id={id}
              type="email"
              value={form.email}
              onChange={(e) => {
                const email = e.target.value
                setForm((f) => ({ ...f, email, userName: isNew && (!f.userName || f.userName === f.email.split('@')[0]) ? email.split('@')[0] : f.userName }))
              }}
              invalid={!!errors.email}
            />
          )}
        </Field>
        <Field label={t('Username')} error={errors.userName} required>
          {(id) => <Input id={id} value={form.userName} onChange={(e) => set('userName', e.target.value)} invalid={!!errors.userName} autoComplete="off" />}
        </Field>
        <Field label={t('Phone')} error={errors.phone}>
          {(id) => <Input id={id} type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}
        </Field>
        <Field label={t('Role')} error={errors.role} required>
          {(id) => (
            <Select id={id} value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
              {staffRoles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </Select>
          )}
        </Field>
        {isNew && (
          <Field label={t('Password')} hint={passwordHint} error={errors.password} required className="sm:col-span-2">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} invalid={!!errors.password} />}
          </Field>
        )}
        <div className="sm:col-span-2">
          <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label={t('Active')} description={t('Inactive employees cannot sign in.')} />
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!member) return
    setSaving(true)
    try {
      await staffApi.resetPassword(member.id, password)
      toast.success(t('Password reset'), t('Share the new password with {name} securely.', { name: member.fullName }))
      setPassword('')
      onClose()
    } catch (err) {
      setError(getFieldErrors(err).newPassword ?? getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!member}
      onClose={() => { setPassword(''); setError(undefined); onClose() }}
      title={t('Reset password')}
      description={member?.fullName}
      size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button type="submit" form="reset-form" loading={saving} disabled={!password}>{t('Reset password')}</Button></>}
    >
      <form id="reset-form" onSubmit={submit}>
        <Field label={t('New password')} hint={t(passwordHint)} error={error}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error} />}
        </Field>
      </form>
    </Modal>
  )
}
