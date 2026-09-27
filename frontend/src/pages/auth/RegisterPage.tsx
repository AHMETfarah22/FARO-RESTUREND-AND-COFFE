import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { useAuth } from '@/features/auth/AuthContext'
import { useWorkspaceTheme } from '@/features/theme/useWorkspaceTheme'
import { getErrorMessage, getFieldErrors } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { homePathFor } from '@/lib/permissions'
import { AuthShell } from './AuthShell'

/** Customer self-registration. Staff accounts are created by managers in Staff Management. */
export function RegisterPage() {
  const { register } = useAuth()
  const { t } = useI18n()
  useWorkspaceTheme('customer')
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) {
      setErrors({ confirm: t('Passwords do not match.') })
      return
    }
    setErrors({})
    setLoading(true)
    try {
      const user = await register({ fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password })
      navigate(homePathFor(user.roles), { replace: true })
    } catch (err) {
      setErrors(getFieldErrors(err))
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthShell tone="sky"
      footer={
        <>
          {t('Already have an account?')}{' '}
          <Link to="/login" className="font-medium text-paper underline underline-offset-4">
            {t('Sign in')}
          </Link>
        </>
      }
    >
      <h1 className="text-2xl font-semibold text-ink">{t('Create your account')}</h1>
      <p className="mt-1 text-sm text-muted">{t('Track your orders and reservations.')}</p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field label={t('Full name')} error={errors.fullName} required>
          {(id) => <Input id={id} autoComplete="name" value={form.fullName} onChange={set('fullName')} invalid={!!errors.fullName} />}
        </Field>
        <Field label={t('Email')} error={errors.email} required>
          {(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />}
        </Field>
        <Field label={t('Phone')} hint={t('Optional — links orders you placed by phone.')} error={errors.phone}>
          {(id) => <Input id={id} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="+90 5xx xxx xx xx" />}
        </Field>
        <Field label={t('Password')} hint={t('At least 8 characters with upper & lower case, a digit and a symbol.')} error={errors.password} required>
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />}
        </Field>
        <Field label={t('Confirm password')} error={errors.confirm} required>
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} />}
        </Field>

        {error && !Object.keys(errors).length && (
          <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full tracking-[0.2em]" loading={loading} disabled={!form.fullName || !form.email || !form.password}>
          {t('CREATE ACCOUNT')}
        </Button>
      </form>
    </AuthShell>
  )
}
