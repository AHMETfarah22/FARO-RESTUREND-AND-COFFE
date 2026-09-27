import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { notificationApi, notificationIcons } from '@/features/notifications/notificationApi'
import { useAuth } from '@/features/auth/AuthContext'
import { localizeNotification } from '@/features/notifications/localize'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { notificationTarget } from '@/lib/permissions'
import { timeAgo } from '@/lib/format'
import type { NotificationItem, NotificationList } from '@/types/api'

/** Top-bar bell with unread badge and a dropdown of the latest notifications (live via SignalR). */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const { data, setData, reload } = useAsync((signal) => notificationApi.list({ take: 8 }, signal))

  useRealtimeEvent<NotificationItem>('notification', (n) =>
    setData((current: NotificationList | null) => ({
      items: [n, ...(current?.items ?? [])].slice(0, 8),
      unreadCount: (current?.unreadCount ?? 0) + 1,
    })),
  )

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

  const openItem = async (n: NotificationItem) => {
    setOpen(false)
    if (!n.isRead) {
      setData((c) => ({ items: c!.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)), unreadCount: Math.max(0, c!.unreadCount - 1) }))
      void notificationApi.markRead(n.id)
    }
    if (n.link) navigate(notificationTarget(user?.roles, n.link))
  }

  const markAll = async () => {
    await notificationApi.markAllRead()
    reload()
  }

  const unread = data?.unreadCount ?? 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex size-10 items-center justify-center rounded-xl text-ink hover:bg-surface"
        aria-label={unread ? t('Notifications, {n} unread', { n: unread }) : t('Notifications')}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4.5 font-bold text-brand-fg ring-2 ring-paper">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-18 z-40 rounded-2xl border border-line bg-paper shadow-xl sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold text-ink">{t('Notifications')}</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
                <CheckCheck className="size-3.5" /> {t('Mark all read')}
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {data?.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">{t("You're all caught up.")}</li>}
            {data?.items.map((item) => {
              const n = localizeNotification(item)
              const Icon = notificationIcons[n.type]
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface">
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', n.type === 'LowStock' ? 'bg-warning/10 text-warning' : 'bg-surface text-ink')}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm', n.isRead ? 'text-ink-800' : 'font-semibold text-ink')}>{n.title}</span>
                      <span className="block truncate text-xs text-muted">{n.message}</span>
                      <span className="mt-0.5 block text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label={t('Unread')} />}
                  </button>
                </li>
              )
            })}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-3 text-center text-sm font-medium text-ink hover:bg-surface">
            {t('View all notifications')}
          </Link>
        </div>
      )}
    </div>
  )
}
