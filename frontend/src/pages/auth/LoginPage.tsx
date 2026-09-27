import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { roleLabel } from '@/lib/labels'
import { homePathFor, workspaceFor, workspaces } from '@/lib/permissions'
import type { Role } from '@/types/api'
import { AuthShell } from './AuthShell'

/** Development-only shortcuts; the same accounts are documented in README.md. */
const demoAccounts: { email: string; password: string; role: Role }[] = [
  { email: 'admin@example.com', password: 'Admin@12345', role: 'SuperAdmin' },
  { email: 'manager@example.com', password: 'Manager@12345', role: 'Manager' },
  { email: 'waiter@example.com', password: 'Waiter@12345', role: 'Waiter' },
  { email: 'kitchen@example.com', password: 'Kitchen@12345', role: 'Kitchen' },
  { email: 'cashier@example.com', password: 'Cashier@12345', role: 'Cashier' },
]

export function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : homePathFor(user.roles), { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthShell
      footer={
        <>
          {t('New customer?')}{' '}
          <Link to="/register" className="font-medium text-paper underline underline-offset-4">
            {t('Create an account')}
          </Link>
        </>
      }
    >
      <h1 className="text-2xl font-semibold text-ink">{t('Welcome back')}</h1>
      <p className="mt-1 text-sm text-muted">{t('Sign in to continue to your portal.')}</p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field label={t('Email or username')}>
          {(id) => (
            <Input id={id} type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('you@example.com')} required />
          )}
        </Field>
        <Field label={t('Password')}>
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink"
                aria-label={showPassword ? t('Hide password') : t('Show password')}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>

        {error && (
          <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full tracking-[0.2em]" loading={loading} disabled={!email || !password}>
          {t('LOGIN')}
        </Button>

        <div className="text-center">
          <button type="button" onClick={() => setForgotOpen(true)} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
            {t('Forgot password?')}
          </button>
        </div>
      </form>

      {import.meta.env.DEV && (
        <div className="mt-7 border-t border-line pt-5">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t('Test accounts · development only')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email)
                  setPassword(a.password)
                  setError(null)
                }}
                className="rounded-xl border border-line px-3 py-2 text-left text-xs hover:border-ink"
                style={{ borderLeft: `3px solid ${workspaces[workspaceFor([a.role])].accent}` }}
              >
                <span className="block font-semibold text-ink">{roleLabel(a.role)}</span>
                <span className="block truncate text-muted">{t(workspaces[workspaceFor([a.role])].title)} · {a.email.split('@')[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title={t('Forgot your password?')}
        size="sm"
        footer={<Button onClick={() => setForgotOpen(false)}>{t('Got it')}</Button>}
      >
        <p className="text-sm text-ink-800">
          {t('For security, staff passwords are reset by a manager or administrator from Staff Management. Please contact your manager to receive a new temporary password.')}
        </p>
      </Modal>
    </AuthShell>
  )
}
