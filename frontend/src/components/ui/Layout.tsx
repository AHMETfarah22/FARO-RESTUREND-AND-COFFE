import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { translate } from '@/lib/i18n'
import { Card } from './Card'

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <div className="relative isolate mb-6 overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper px-5 py-5 shadow-[var(--shadow-soft)] sm:px-7 sm:py-6 print:border-0 print:p-0 print:shadow-none">
      {/* Restaurant photo (set by the layout as --cover-image), fading into white behind the title */}
      <div className="absolute inset-y-0 right-0 -z-20 w-full bg-cover bg-center sm:w-3/5 print:hidden" style={{ backgroundImage: 'var(--cover-image)' }} aria-hidden="true" />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-paper from-35% via-paper/85 to-paper/20 max-sm:via-paper/90 max-sm:to-paper/75 print:hidden"
        aria-hidden="true"
      />
      <span className="absolute inset-y-0 left-0 w-1 bg-brand print:hidden" aria-hidden="true" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {back && (
            <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
              <ChevronLeft className="size-4" /> {back.label}
            </Link>
          )}
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-800/75">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** KPI tile: label, headline value, optional change vs. previous period. */
export function StatCard({
  label,
  value,
  change,
  hint,
  icon,
  to,
  className,
}: {
  label: string
  value: ReactNode
  change?: number | null
  hint?: ReactNode
  icon?: ReactNode
  to?: string
  className?: string
}) {
  const body = (
    <Card className={cn('h-full p-5 transition-shadow', to && 'hover:shadow-md', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{label}</p>
        {icon && <span className="flex size-9 items-center justify-center rounded-xl bg-surface text-ink">{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink tabular-nums sm:text-3xl">{value}</p>
      <div className="mt-2 flex min-h-5 items-center gap-2 text-xs">
        {change !== undefined && change !== null && (
          <span className={cn('inline-flex items-center gap-1 font-semibold', change >= 0 ? 'text-success' : 'text-danger')}>
            {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted">{hint}</span>}
      </div>
    </Card>
  )
  return to ? (
    <Link to={to} className="block rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = translate('Search…'),
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-xl border border-line bg-paper pr-3 pl-10 text-sm placeholder:text-muted/70 hover:border-ink/30 focus:border-ink focus:outline-none"
      />
    </div>
  )
}

/** Segmented tabs (filters, view switches). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  className?: string
}) {
  return (
    <div className={cn('no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-paper p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
            value === o.value ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface hover:text-ink',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-xs', value === o.value ? 'bg-paper/20' : 'bg-surface')}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  onChange,
}: {
  page: number
  totalPages: number
  totalCount: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return <p className="px-5 py-4 text-sm text-muted">{translate('{n} result(s)', { n: totalCount })}</p>
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3">
      <p className="text-sm text-muted">
        {translate('Page {page} of {pages} · {n} results', { page, pages: totalPages, n: totalCount })}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded-lg border border-line p-2 hover:bg-surface disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label={translate('Previous page')}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          className="rounded-lg border border-line p-2 hover:bg-surface disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label={translate('Next page')}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

/** Table shell with consistent styling; horizontal scroll on small screens. */
export function DataTable({ head, children, className }: { head: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-surface/60 text-xs tracking-wide text-muted uppercase">{head}</thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export const th = 'px-5 py-3 font-semibold whitespace-nowrap'
export const td = 'px-5 py-3.5 align-middle'
