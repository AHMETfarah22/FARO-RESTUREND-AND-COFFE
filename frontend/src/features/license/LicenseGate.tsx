import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Check, Copy, KeyRound, Store } from 'lucide-react'
import { LogoMark, Logo } from '@/components/brand/Logo'
import { LangToggle } from '@/components/LangToggle'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage, getFieldErrors, setLicenseRequiredHandler, tokenStore } from '@/lib/api'
import { licenseApi, setupApi } from '@/lib/endpoints'
import { formatDateOnly } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { LicenseStatus } from '@/types/api'

type Phase = 'checking' | 'locked' | 'setup' | 'ready'

/**
 * Installation gate (real installations only; the demo has no license). Until the API reports an active license
 * it shows the activation screen with this computer's machine code; on a brand-new installation it then asks
 * for the restaurant name and the first administrator. A 402 from the API at any time brings the screen back.
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [check, setCheck] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const status = await licenseApi.status(controller.signal)
        setLicense(status)
        if (status.status !== 'Active') return setPhase('locked')
        setPhase((await setupApi.status(controller.signal)).required ? 'setup' : 'ready')
      } catch {
        // API not reachable: let the portal load; its pages show "Cannot reach the server" and retry.
        if (!controller.signal.aborted) setPhase('ready')
      }
    }
    void run()
    return () => controller.abort()
  }, [check])

  // The license was removed or expired while the portal was open.
  useEffect(() => {
    setLicenseRequiredHandler(() => setCheck((c) => c + 1))
    return () => setLicenseRequiredHandler(null)
  }, [])

  if (phase === 'ready') return <>{children}</>
  if (phase === 'checking')
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-ink-900">
        <LogoMark />
        <Spinner className="text-paper/60" />
      </div>
    )
  if (phase === 'setup') return <SetupScreen suggestedName={license?.customer ?? ''} onDone={() => setPhase('ready')} />
  return <ActivationScreen license={license!} onActivated={() => setCheck((c) => c + 1)} />
}

function InstallShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-ink-900 px-4 py-10">
      <LangToggle tone="light" className="absolute top-4 right-4" />
      <Logo size="lg" tone="light" align="center" />
      <div className="mt-10 w-full max-w-lg rounded-3xl bg-paper p-6 text-ink shadow-2xl sm:p-8">{children}</div>
      <p className="mt-10 text-xs text-paper/30">© {new Date().getFullYear()} FARO RESTURENT AND COFFE</p>
    </div>
  )
}

function ActivationScreen({ license, onActivated }: { license: LicenseStatus; onActivated: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const codeRef = useRef<HTMLInputElement>(null)
  const [key, setKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Guests scanning a table's QR code never see the activation form.
  if (window.location.pathname.startsWith(`${import.meta.env.BASE_URL}menu/`))
    return (
      <InstallShell>
        <p className="text-center text-sm text-ink-800">{t('The menu is temporarily unavailable. Please ask a waiter.')}</p>
      </InstallShell>
    )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(license.machineCode)
    } catch {
      // Clipboard needs HTTPS or localhost; over the Wi-Fi address the code is selected for Ctrl+C instead.
      codeRef.current?.select()
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const status = await licenseApi.activate(key)
      toast.success(t('License activated'), status.customer ?? undefined)
      onActivated()
    } catch (err) {
      setError(getFieldErrors(err).key ?? getErrorMessage(err))
      setSaving(false)
    }
  }

  const problem = {
    Expired: t('The installed license expired on {date}. Ask for a new key.', { date: license.expiresOn ? formatDateOnly(license.expiresOn) : '—' }),
    OtherMachine: t('The installed license belongs to another computer.'),
    Invalid: t('The license file is damaged. Enter the key again.'),
  }[license.status as string]

  return (
    <InstallShell>
      <span className="flex size-11 items-center justify-center rounded-2xl bg-ink-900 text-paper">
        <KeyRound className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">{t('Activate FARO')}</h1>
      <p className="mt-1 text-sm text-muted">{t('This computer needs a license key before the portal can be used.')}</p>
      {problem && <p className="mt-4 rounded-xl bg-warning/10 px-3.5 py-2.5 text-sm text-warning">{problem}</p>}

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t('Machine code')}</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={codeRef}
            readOnly
            value={license.machineCode}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 bg-transparent font-mono text-xl font-semibold tracking-wider text-ink outline-none sm:text-2xl"
            aria-label={t('Machine code')}
          />
          <Button variant="secondary" size="sm" onClick={() => void copy()} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>
            {copied ? t('Copied') : t('Copy')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{t('Send this code to your FARO provider. You will receive a license key for this computer.')}</p>
      </div>

      <form onSubmit={activate} className="mt-6 space-y-4" noValidate>
        <Field label={t('License key')} error={error ?? undefined}>
          {(id) => (
            <Textarea
              id={id}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('Paste the key you received (FARO1…)')}
              className="font-mono text-xs break-all"
              rows={4}
              invalid={!!error}
              spellCheck={false}
            />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={saving} disabled={!key.trim()}>
          {t('Activate')}
        </Button>
      </form>
    </InstallShell>
  )
}

function SetupScreen({ suggestedName, onDone }: { suggestedName: string; onDone: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ restaurantName: suggestedName, fullName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) return setErrors({ confirm: t('Passwords do not match.') })
    setErrors({})
    setSaving(true)
    try {
      const session = await setupApi.complete({ restaurantName: form.restaurantName, fullName: form.fullName, email: form.email, password: form.password })
      // AuthProvider restores the session from the stored token as soon as the portal opens.
      tokenStore.set(session.accessToken)
      onDone()
    } catch (err) {
      const fields = getFieldErrors(err)
      setErrors(fields)
      setError(Object.keys(fields).length && !fields.account ? null : (fields.account ?? getErrorMessage(err)))
      setSaving(false)
    }
  }

  return (
    <InstallShell>
      <span className="flex size-11 items-center justify-center rounded-2xl bg-ink-900 text-paper">
        <Store className="size-5" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">{t('Welcome! Set up your restaurant')}</h1>
      <p className="mt-1 text-sm text-muted">{t('Create the administrator account. You can add your staff afterwards from Staff Management.')}</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label={t('Restaurant name')} error={errors.restaurantName} required>
          {(id) => <Input id={id} value={form.restaurantName} onChange={set('restaurantName')} invalid={!!errors.restaurantName} />}
        </Field>
        <Field label={t('Full name')} error={errors.fullName} required>
          {(id) => <Input id={id} autoComplete="name" value={form.fullName} onChange={set('fullName')} invalid={!!errors.fullName} />}
        </Field>
        <Field label={t('Email')} hint={t('You sign in with this address.')} error={errors.email} required>
          {(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} invalid={!!errors.email} />}
        </Field>
        <Field label={t('Password')} hint={t('At least 8 characters with upper & lower case, a digit and a symbol.')} error={errors.password} required>
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} invalid={!!errors.password} />}
        </Field>
        <Field label={t('Confirm password')} error={errors.confirm} required>
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} invalid={!!errors.confirm} />}
        </Field>
        {error && (
          <p className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={saving}
          disabled={!form.restaurantName.trim() || !form.fullName.trim() || !form.email.trim() || !form.password}
        >
          {t('Create administrator and start')}
        </Button>
      </form>
    </InstallShell>
  )
}
