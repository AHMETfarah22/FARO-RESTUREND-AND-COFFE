import type { ReactNode } from 'react'
import { CoverHero } from '@/components/brand/CoverHero'
import { Logo } from '@/components/brand/Logo'
import { LangToggle } from '@/components/LangToggle'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import { restaurantApi } from '@/lib/endpoints'
import { useI18n } from '@/lib/i18n'

/**
 * Login / register frame. Large screens: the restaurant's cover photo on the left, the white form card on the right.
 * Phones: the photo becomes a dark backdrop behind the logo and card.
 */
export function AuthShell({ children, footer, tone = 'ink' }: { children: ReactNode; footer?: ReactNode; tone?: 'ink' | 'sky' }) {
  const { data: brand } = useAsync((signal) => restaurantApi.publicInfo(signal))
  const { t } = useI18n()
  const cover = brand?.coverImageUrl
  const sky = tone === 'sky'
  const tagline = sky ? t('Your account') : t('Restaurant Management Portal')

  return (
    <div className={cn('grid min-h-dvh lg:grid-cols-[1.1fr_1fr]', sky ? 'bg-brand' : 'bg-ink-900')}>
      {/* Photo panel (desktop) */}
      <CoverHero image={cover} overlay="soft" tone={tone} className="hidden flex-col justify-between p-12 lg:flex">
        <Logo tone="light" />
        <div className="max-w-md">
          <p className="font-display text-5xl leading-[1.05] font-semibold">{t('Fine food.')}<br />{t('Honest coffee.')}</p>
          <p className="mt-5 text-sm leading-relaxed text-paper/70">
            {brand?.description ?? t('Premium restaurant & specialty coffee.')}{' '}
            {sky ? t('Create an account to keep all your orders in one place.') : t('Everything your team needs — orders, kitchen, tables and reports — in one place.')}
          </p>
        </div>
        <p className="text-xs tracking-[0.3em] text-paper/50 uppercase">{tagline}</p>
      </CoverHero>

      {/* Form side */}
      <div className="relative isolate flex flex-col items-center justify-center overflow-hidden px-4 py-10">
        {/* Phone backdrop */}
        <CoverHero image={cover} width={900} backdrop tone={tone} className="lg:hidden" />
        <LangToggle tone="light" className="absolute top-4 right-4 z-10" />

        <div className="flex flex-col items-center lg:hidden">
          <Logo size="lg" tone="light" align="center" />
          <p className="mt-4 text-xs tracking-[0.3em] text-paper/60 uppercase">{tagline}</p>
        </div>

        <div className="relative mt-10 w-full max-w-md rounded-3xl bg-paper p-6 text-ink shadow-2xl sm:p-8 lg:mt-0">{children}</div>
        {footer && <div className="relative mt-6 text-center text-sm text-paper/70">{footer}</div>}
        <p className="relative mt-10 text-xs text-paper/30">© {new Date().getFullYear()} FARO RESTURENT AND COFFE</p>
      </div>
    </div>
  )
}
