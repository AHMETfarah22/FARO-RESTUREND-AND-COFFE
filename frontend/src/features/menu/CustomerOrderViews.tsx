import { useState } from 'react'
import { Bell, BellOff, BellRing, Check, ChefHat, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatDateTime, formatTime } from '@/lib/format'
import type { OrderStatus, PublicOrderStatus } from '@/types/api'
import { enableOrderNotifications, notificationPermission, pushSupport } from './customerPush'
import { useCustomerText } from './customerText'

const steps: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served']
const sequence: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served', 'Completed']

/** TR / EN switch for the customer pages (sits on the light-blue header). */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useCustomerText()
  return (
    <div role="group" aria-label={t.language} className={cn('inline-flex h-10 items-center rounded-full bg-paper/20 p-1 ring-1 ring-paper/45 backdrop-blur', className)}>
      {(['tr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn('h-8 min-w-10 rounded-full px-3 text-sm font-bold transition-colors', lang === l ? 'bg-paper text-brand-ink shadow-sm' : 'text-paper hover:bg-paper/15')}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** One order with its live progress steps — large and clear for reading at the table. */
export function OrderProgressCard({ order, money, placedToday }: { order: PublicOrderStatus; money: (v: number) => string; placedToday: boolean }) {
  const { t } = useCustomerText()
  const index = sequence.indexOf(order.status)
  const ready = order.status === 'Ready'

  return (
    <article className={cn('overflow-hidden rounded-3xl bg-paper shadow-[var(--shadow-soft)] ring-1', ready ? 'ring-2 ring-brand' : 'ring-line')}>
      {ready && (
        <div className="flex items-center gap-2 bg-brand px-5 py-3 text-sm font-bold tracking-wide text-brand-fg">
          <BellRing className="size-5 animate-pulse" /> {t.readyBanner}
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-semibold text-ink">{t.orderNo(order.number)}</p>
            <p className="mt-0.5 text-sm text-muted">
              {order.tableName ?? t.takeaway} · {placedToday ? formatTime(order.createdAt) : formatDateTime(order.createdAt)}
            </p>
          </div>
          <p className="text-lg font-bold text-brand-ink tabular-nums">{money(order.total)}</p>
        </div>

        {order.status === 'Cancelled' ? (
          <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-base text-danger">{t.cancelledText}</p>
        ) : order.status === 'Completed' ? (
          <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-base text-ink-800">{t.completedText}</p>
        ) : (
          <>
            <p className="mt-5 text-base font-semibold text-brand-ink">{t.headline[order.status]}</p>
            <ol className="relative mt-4 grid grid-cols-5 gap-1" aria-label={t.progress}>
              {/* connecting line behind the step circles */}
              <span className="absolute top-[18px] right-[10%] left-[10%] h-0.5 bg-line" aria-hidden="true" />
              <span
                className="absolute top-[18px] left-[10%] h-0.5 bg-brand transition-[width] duration-500"
                style={{ width: `${(Math.min(index, steps.length - 1) / (steps.length - 1)) * 80}%` }}
                aria-hidden="true"
              />
              {steps.map((s, i) => {
                const done = index >= sequence.indexOf(s)
                const current = order.status === s
                return (
                  <li key={s} className="relative flex flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
                    <span
                      className={cn(
                        'flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                        done ? 'border-brand bg-brand text-brand-fg' : 'border-line bg-paper text-muted',
                        current && 'ring-4 ring-brand/20',
                      )}
                    >
                      {done && !current ? <Check className="size-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={cn('mt-2 px-0.5 text-[11px] leading-tight break-words sm:text-xs', current ? 'font-bold text-brand-ink' : 'text-muted')}>{t.steps[s]}</span>
                  </li>
                )
              })}
            </ol>
          </>
        )}

        <ul className="mt-5 space-y-2 border-t border-line pt-4 text-base">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="font-semibold tabular-nums">{i.quantity}×</span> {i.productName}
                {i.notes && <span className="block text-sm text-muted italic">“{i.notes}”</span>}
              </span>
              <span className="shrink-0 tabular-nums">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/** Full-screen "your order is ready" alert shown in the page (works on every phone while the page is open). */
export function ReadyOverlay({ order, onClose }: { order: PublicOrderStatus | null; onClose: () => void }) {
  const { t } = useCustomerText()
  if (!order) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-ink/70 p-6 backdrop-blur-sm" role="alertdialog" aria-labelledby="ready-title">
      <div className="w-full max-w-sm rounded-3xl bg-paper p-8 text-center shadow-2xl">
        <span className="mx-auto flex size-20 animate-bounce items-center justify-center rounded-full bg-brand text-brand-fg shadow-lg shadow-brand/40">
          <ChefHat className="size-10" />
        </span>
        <p id="ready-title" className="mt-6 font-display text-4xl font-semibold text-ink">{t.readyTitle}</p>
        <p className="mt-3 text-base text-muted">{t.readyBody(order.number, order.tableName)}</p>
        <Button size="lg" className="mt-8 w-full text-base tracking-[0.2em]" onClick={onClose}>
          {t.ok}
        </Button>
      </div>
    </div>
  )
}

/** Explains and enables phone notifications for the customer's open orders. */
export function NotifyCard({ orderIds }: { orderIds: string[] }) {
  const { t } = useCustomerText()
  const support = pushSupport()
  const [permission, setPermission] = useState(notificationPermission())
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || orderIds.length === 0) return null

  if (support === 'supported' && permission === 'granted') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-3.5 text-[15px] ring-1 ring-line">
        <Bell className="size-5 shrink-0 text-brand" />
        <p className="flex-1 text-ink-800">{t.notifyOn}</p>
      </div>
    )
  }

  if (support === 'supported' && permission !== 'denied') {
    return (
      <div className="rounded-3xl bg-gradient-to-br from-brand to-brand-ink p-5 text-brand-fg shadow-lg shadow-brand/25">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 size-6 shrink-0" />
          <div className="flex-1">
            <p className="text-lg font-semibold">{t.notifyTitle}</p>
            <p className="mt-1 text-[15px] text-paper/85">{t.notifyBody}</p>
          </div>
          <button type="button" onClick={() => setDismissed(true)} className="-m-1 rounded-full p-2 text-paper/60 hover:text-paper" aria-label={t.dismiss}>
            <X className="size-5" />
          </button>
        </div>
        <Button
          variant="secondary"
          size="lg"
          className="mt-4 w-full border-paper text-base text-brand-ink"
          loading={busy}
          onClick={async () => {
            setBusy(true)
            try {
              setPermission(await enableOrderNotifications(orderIds))
            } finally {
              setBusy(false)
            }
          }}
          icon={<Bell className="size-5" />}
        >
          {t.notifyButton}
        </Button>
      </div>
    )
  }

  // Denied, insecure (plain http) or unsupported browser: in-page alerts still work while the page is open.
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-paper px-4 py-3.5 text-[15px] ring-1 ring-line">
      {permission === 'denied' ? <BellOff className="mt-0.5 size-5 shrink-0 text-brand" /> : <Smartphone className="mt-0.5 size-5 shrink-0 text-brand" />}
      <p className="flex-1 text-ink-800">{permission === 'denied' ? t.notifyDenied : t.notifyInPage}</p>
      <button type="button" onClick={() => setDismissed(true)} className="-m-1 rounded-full p-2 text-muted hover:text-ink" aria-label={t.dismiss}>
        <X className="size-5" />
      </button>
    </div>
  )
}
