import { cn } from '@/lib/cn'

type LogoSize = 'sm' | 'md' | 'lg'
type LogoTone = 'dark' | 'light'

interface LogoProps {
  size?: LogoSize
  /** `dark` = black text (for light backgrounds), `light` = white text (for dark backgrounds). */
  tone?: LogoTone
  align?: 'left' | 'center'
  className?: string
}

const BRAND_NAME = 'FARO RESTURENT AND COFFE'

const sizes: Record<LogoSize, { top: string; bottom: string; rule: string; gap: string }> = {
  sm: { top: 'text-2xl tracking-[0.32em]', bottom: 'text-[8.5px] tracking-[0.3em]', rule: 'w-3', gap: 'mt-1.5' },
  md: { top: 'text-4xl tracking-[0.34em]', bottom: 'text-[10px] tracking-[0.34em]', rule: 'w-5', gap: 'mt-2' },
  lg: {
    top: 'text-5xl tracking-[0.34em] sm:text-7xl',
    bottom: 'text-[10px] tracking-[0.32em] sm:text-xs sm:tracking-[0.4em]',
    rule: 'w-6 sm:w-10',
    gap: 'mt-3',
  },
}

/**
 * Text-based brand mark: "FARO" set large in an elegant serif over a spaced "RESTURENT AND COFFE".
 * Used in the sidebar, login, QR menu, receipts and invoices.
 */
export function Logo({ size = 'md', tone = 'dark', align = 'left', className }: LogoProps) {
  const s = sizes[size]
  const color = tone === 'dark' ? 'text-ink' : 'text-paper'
  const ruleColor = tone === 'dark' ? 'bg-ink/30' : 'bg-paper/40'

  return (
    <div
      className={cn('inline-flex select-none flex-col', align === 'center' ? 'items-center' : 'items-start', className)}
      aria-label={BRAND_NAME}
      role="img"
    >
      {/* The trailing letter-spacing is balanced with a negative margin so the word stays optically centred. */}
      <span className={cn('font-display font-semibold leading-none', s.top, color)} style={{ marginRight: '-0.32em' }}>
        FARO
      </span>
      <span className={cn('flex items-center gap-2', s.gap, align === 'center' && 'justify-center')}>
        <span className={cn('h-px', s.rule, ruleColor)} />
        <span className={cn('font-sans font-medium leading-none whitespace-nowrap', s.bottom, color)}>RESTURENT AND COFFE</span>
        <span className={cn('h-px', s.rule, ruleColor)} />
      </span>
    </div>
  )
}

/** Compact square mark for collapsed sidebars and favicons. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-xl bg-paper font-display text-2xl font-semibold text-ink',
        className,
      )}
      aria-label={BRAND_NAME}
      role="img"
    >
      F
    </span>
  )
}
