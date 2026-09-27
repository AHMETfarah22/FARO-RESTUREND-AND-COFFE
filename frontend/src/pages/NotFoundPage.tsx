import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { translate as t } from '@/lib/i18n'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-ink-900 px-4 text-center">
      <Logo tone="light" align="center" />
      <div>
        <p className="font-display text-7xl font-semibold text-paper">404</p>
        <p className="mt-2 text-paper/60">{t('This page could not be found.')}</p>
      </div>
      <Link to="/" className="rounded-xl bg-paper px-5 py-3 text-sm font-medium text-ink hover:bg-surface">
        {t('Back to home')}
      </Link>
    </div>
  )
}
