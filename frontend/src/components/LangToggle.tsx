import { cn } from '@/lib/cn'
import { useI18n, type Lang } from '@/lib/i18n'

/** TR / EN switch for the staff portal. `tone="light"` is for dark backgrounds (login photo). */
export function LangToggle({ className, tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t('Language')}
      className={cn(
        'inline-flex h-9 shrink-0 items-center rounded-full p-0.5 ring-1',
        tone === 'dark' ? 'bg-surface ring-line' : 'bg-paper/15 ring-paper/40 backdrop-blur',
        className,
      )}
    >
      {(['tr', 'en'] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn(
            'h-8 min-w-9 rounded-full px-2.5 text-xs font-bold transition-colors',
            lang === l
              ? tone === 'dark' ? 'bg-brand text-brand-fg shadow-sm' : 'bg-paper text-ink shadow-sm'
              : tone === 'dark' ? 'text-muted hover:text-ink' : 'text-paper hover:bg-paper/15',
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
