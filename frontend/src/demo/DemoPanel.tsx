import { useEffect, useRef, useState } from 'react'
import { ExternalLink, MessageCircle, QrCode, RotateCcw, Sparkles, X } from 'lucide-react'
import { router } from '@/app/router'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { env } from '@/config/env'
import { useAuth } from '@/features/auth/AuthContext'
import { demoCustomerAccount, testAccounts, type TestAccount } from '@/features/auth/testAccounts'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { roleLabel } from '@/lib/labels'
import { homePathFor, workspaceFor, workspaces } from '@/lib/permissions'
import { db, resetDb } from './db'

const accounts = [...testAccounts, demoCustomerAccount]

/**
 * The floating "DEMO" button of the GitHub Pages build: explains the demo, switches roles with one click,
 * opens the guest QR menu in a new tab (orders placed there show up live) and resets the sample data.
 */
export function DemoPanel() {
  const { user, login } = useAuth()
  const { t } = useI18n()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const switchTo = async (account: TestAccount) => {
    setBusy(account.email)
    setError(null)
    try {
      const signedIn = await login(account.email, account.password)
      await router.navigate(homePathFor(signedIn.roles))
      setOpen(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const openMenu = () => {
    const table = [...db().tables].sort((a, b) => a.number - b.number)[0]
    if (table) window.open(`${import.meta.env.BASE_URL}menu/table/${table.id}`, '_blank', 'noopener')
  }

  const reset = async () => {
    const ok = await confirm({
      title: t('Reset demo data?'),
      message: t('All changes made in this browser are removed and fresh sample data is loaded.'),
      confirmLabel: t('Reset'),
      danger: true,
    })
    if (!ok) return
    resetDb()
    window.location.reload()
  }

  return (
    <div ref={ref} className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 lg:right-5 lg:bottom-5 print:hidden">
      {open && (
        <div
          role="dialog"
          aria-label={t('Live demo')}
          className="absolute right-0 bottom-full mb-3 max-h-[calc(100dvh-9rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-paper p-5 text-ink shadow-2xl ring-1 ring-line"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-paper">
              <Sparkles className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('Live demo')}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {t('Every feature works. Your changes are kept only in this browser, and new sample data is loaded every day.')}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="-mt-1 -mr-1 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink" aria-label={t('Close')}>
              <X className="size-4" />
            </button>
          </div>

          <p className="mt-5 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{t('Try another role')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {accounts.map((a) => {
              const current = user?.email === a.email
              const workspace = workspaces[workspaceFor([a.role])]
              return (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => void switchTo(a)}
                  disabled={!!busy || current}
                  className={cn(
                    'rounded-xl border px-2.5 py-2 text-left text-xs transition-colors disabled:cursor-default',
                    current ? 'border-ink bg-surface' : 'border-line hover:border-ink',
                    busy === a.email && 'animate-pulse',
                  )}
                  style={{ borderLeft: `3px solid ${workspace.accent}` }}
                  aria-current={current || undefined}
                >
                  <span className="block truncate font-semibold">{roleLabel(a.role)}</span>
                  <span className="block truncate text-muted">{t(workspace.title)}</span>
                </button>
              )
            })}
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          <button type="button" onClick={openMenu} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-line px-3 py-3 text-left hover:border-ink">
            <QrCode className="size-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t('Open the customer QR menu')}</span>
              <span className="block text-xs text-muted">{t('Opens in a new tab — orders placed there appear here live.')}</span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-muted" />
          </button>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => void reset()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink">
              <RotateCcw className="size-3.5" /> {t('Reset demo data')}
            </button>
            {env.demoContactUrl && (
              <a
                href={env.demoContactUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 py-2 text-xs font-semibold text-paper hover:bg-ink-800"
              >
                <MessageCircle className="size-3.5" /> {t('Buy / contact')}
              </a>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-ink-900/95 py-2.5 pr-4 pl-3.5 text-[11px] font-semibold tracking-[0.2em] text-paper shadow-xl ring-1 ring-paper/15 backdrop-blur hover:bg-ink-900"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
        </span>
        DEMO
      </button>
    </div>
  )
}
