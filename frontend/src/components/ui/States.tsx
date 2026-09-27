import type { ReactNode } from 'react'
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { translate } from '@/lib/i18n'
import { Button } from './Button'
import { Spinner } from './Spinner'

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-muted">{icon ?? <Inbox className="size-6" />}</span>
      <p className="mt-4 font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)} role="alert">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertCircle className="size-6" />
      </span>
      <p className="mt-4 font-medium text-ink">{translate('Something went wrong')}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} icon={<RefreshCw className="size-4" />}>
          {translate('Try again')}
        </Button>
      )}
    </div>
  )
}

export function LoadingState({ label = translate('Loading…'), className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-sm text-muted', className)} role="status">
      <Spinner /> {label}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-line/70', className)} aria-hidden="true" />
}

/** Standard loading/error/empty switch for a data block. */
export function AsyncBlock<T>({
  loading,
  error,
  data,
  onRetry,
  empty,
  isEmpty,
  skeleton,
  children,
}: {
  loading: boolean
  error: string | null
  data: T | null
  onRetry?: () => void
  empty?: ReactNode
  isEmpty?: (data: T) => boolean
  skeleton?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (data === null) {
    if (error) return <ErrorState message={error} onRetry={onRetry} />
    if (loading) return <>{skeleton ?? <LoadingState />}</>
    return null
  }
  if (isEmpty?.(data)) return <>{empty}</>
  return <>{children(data)}</>
}
