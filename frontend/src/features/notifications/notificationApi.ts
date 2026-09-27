import { api } from '@/lib/api'
import type { NotificationList, NotificationType } from '@/types/api'
import { AlertTriangle, Bell, CalendarDays, ClipboardList, CreditCard, type LucideIcon } from 'lucide-react'

export const notificationApi = {
  list: (params: { unreadOnly?: boolean; take?: number } = {}, signal?: AbortSignal) =>
    api.get<NotificationList>('/notifications', { params, signal }).then((r) => r.data),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  remove: (id: string) => api.delete(`/notifications/${id}`),
}

export const notificationIcons: Record<NotificationType, LucideIcon> = {
  NewOrder: ClipboardList,
  Reservation: CalendarDays,
  LowStock: AlertTriangle,
  Payment: CreditCard,
  System: Bell,
}
