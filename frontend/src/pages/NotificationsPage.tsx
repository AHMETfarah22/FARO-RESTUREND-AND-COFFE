import { useState } from 'react'
import { CheckCheck, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader, Tabs } from '@/components/ui/Layout'
import { AsyncBlock, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { notificationApi, notificationIcons } from '@/features/notifications/notificationApi'
import { useAuth } from '@/features/auth/AuthContext'
import { localizeNotification } from '@/features/notifications/localize'
import { useRealtimeEvent } from '@/features/realtime/RealtimeContext'
import { useAsync } from '@/hooks/useAsync'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import { notificationTypeLabel } from '@/lib/labels'
import { notificationTarget } from '@/lib/permissions'
import { formatDateTime, timeAgo } from '@/lib/format'
import type { NotificationItem } from '@/types/api'

export function NotificationsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { data, error, loading, reload, setData } = useAsync((signal) => notificationApi.list({ unreadOnly: filter === 'unread', take: 100 }, signal), [filter])

  useRealtimeEvent<NotificationItem>('notification', (n) => setData((c) => ({ items: [n, ...(c?.items ?? [])], unreadCount: (c?.unreadCount ?? 0) + 1 })))

  const open = (n: NotificationItem) => {
    if (!n.isRead) {
      void notificationApi.markRead(n.id)
      setData((c) => ({ items: c!.items.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)), unreadCount: Math.max(0, c!.unreadCount - 1) }))
    }
    if (n.link) navigate(notificationTarget(user?.roles, n.link))
  }

  const remove = async (n: NotificationItem) => {
    try {
      await notificationApi.remove(n.id)
      setData((c) => ({ items: c!.items.filter((x) => x.id !== n.id), unreadCount: c!.unreadCount - (n.isRead ? 0 : 1) }))
    } catch (err) {
      toast.error(t('Could not delete notification'), getErrorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title={t('Notifications')}
        description={t('New orders, reservations, low stock and payments — delivered in real time.')}
        actions={
          <Button variant="secondary" icon={<CheckCheck className="size-4" />} disabled={!data?.unreadCount} onClick={async () => { await notificationApi.markAllRead(); reload() }}>
            {t('Mark all as read')}
          </Button>
        }
      />
      <Tabs className="mb-5" value={filter} onChange={setFilter} options={[{ value: 'all' as const, label: t('All') }, { value: 'unread' as const, label: t('Unread'), count: data?.unreadCount }]} />
      <Card>
        <AsyncBlock data={data} loading={loading} error={error} onRetry={reload} isEmpty={(d) => d.items.length === 0} empty={<EmptyState title={t("You're all caught up.")} description={t('New notifications will appear here instantly.')} />}>
          {({ items }) => (
            <ul className="divide-y divide-line">
              {items.map((item) => {
                const n = localizeNotification(item)
                const Icon = notificationIcons[n.type]
                return (
                  <li key={n.id} className={cn('flex items-start gap-4 px-5 py-4', !n.isRead && 'bg-surface/60')}>
                    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', n.type === 'LowStock' ? 'bg-warning/10 text-warning' : 'bg-brand text-brand-fg')}>
                      <Icon className="size-4" />
                    </span>
                    <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                      <p className={cn('text-sm', n.isRead ? 'text-ink-800' : 'font-semibold text-ink')}>{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                      <p className="mt-1 text-xs text-muted" title={formatDateTime(n.createdAt)}>{notificationTypeLabel(n.type)} · {timeAgo(n.createdAt)}</p>
                    </button>
                    {!n.isRead && <span className="mt-2 size-2 rounded-full bg-brand" aria-label={t('Unread')} />}
                    <button type="button" onClick={() => remove(n)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-danger" aria-label={t('Delete notification')}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </AsyncBlock>
      </Card>
    </>
  )
}
