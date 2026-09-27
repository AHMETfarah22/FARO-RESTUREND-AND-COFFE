import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { translate as t } from '@/lib/i18n'

/** Last-resort error screen for crashes and failed lazy chunks. */
export function RouteError() {
  const error = useRouteError()
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message)
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : chunkFailed
      ? t('A new version of the portal is available.')
      : t('An unexpected error occurred.')

  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink-900 px-4 text-center">
      <Logo tone="light" align="center" />
      <div>
        <p className="font-display text-3xl font-semibold text-paper">{t('Something went wrong')}</p>
        <p className="mt-2 text-sm text-paper/60">{message}</p>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-paper px-5 py-3 text-sm font-medium text-ink hover:bg-surface">
          {t('Reload')}
        </button>
        <Link to="/" className="rounded-xl border border-paper/30 px-5 py-3 text-sm font-medium text-paper hover:bg-paper/10">
          {t('Home')}
        </Link>
      </div>
    </div>
  )
}
