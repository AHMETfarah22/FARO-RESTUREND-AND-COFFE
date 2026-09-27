import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { imageSrcSet, sizedImage } from '@/lib/images'

interface WorkspaceHeroProps {
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Restaurant cover photo, blended into the workspace colour. */
  image?: string | null
  /** Quick numbers shown as glass tiles. */
  stats?: { label: string; value: ReactNode; highlight?: boolean }[]
  actions?: ReactNode
  className?: string
}

/**
 * Welcome banner at the top of every role's home page. Painted in the workspace colours
 * (gold on black for admins, indigo for managers, emerald for waiters, plum for cashiers).
 */
export function WorkspaceHero({ eyebrow, title, description, image, stats, actions, className }: WorkspaceHeroProps) {
  const [loaded, setLoaded] = useState(false)
  const src = sizedImage(image, 1400)

  return (
    <section className={cn('relative isolate mb-6 overflow-hidden rounded-[var(--radius-card)] bg-sidebar px-6 py-7 text-paper sm:px-8 sm:py-9', className)}>
      {src && (
        <img
          src={src}
          srcSet={imageSrcSet(image, 1400)}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoaded(true)}
          className={cn('absolute inset-0 -z-20 size-full object-cover saturate-[.85] transition-opacity duration-700', loaded ? 'opacity-100' : 'opacity-0')}
        />
      )}
      {/* Solid workspace colour behind the text, the photo shows through on the right */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-sidebar from-30% via-sidebar/75 to-sidebar/10 max-sm:via-sidebar/85 max-sm:to-sidebar/45"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-brand/35 to-transparent" aria-hidden="true" />

      <p className="text-xs font-semibold tracking-[0.25em] text-sidebar-accent uppercase">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">{title}</h1>
      {description && <p className="mt-2 max-w-xl text-sm text-paper/75">{description}</p>}

      {stats && stats.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {stats.map((s) => (
            <div
              key={s.label}
              className={cn(
                'min-w-[8.5rem] rounded-xl px-4 py-3 ring-1 backdrop-blur',
                s.highlight ? 'bg-sidebar-accent text-sidebar ring-transparent' : 'bg-sidebar/55 ring-paper/15',
              )}
            >
              <dt className={cn('text-[11px] font-semibold tracking-[0.14em] uppercase', s.highlight ? 'text-sidebar/70' : 'text-paper/60')}>{s.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {actions && <div className="mt-6 flex flex-wrap gap-2">{actions}</div>}
    </section>
  )
}
