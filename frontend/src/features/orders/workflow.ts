import type { OrderStatus } from '@/types/api'

export interface StatusAction {
  to: OrderStatus
  label: string
  primary?: boolean
  danger?: boolean
}

/** Next steps offered for each status. Mirrors the transition table in OrderService (backend). */
export const nextActions: Record<OrderStatus, StatusAction[]> = {
  Pending: [
    { to: 'Confirmed', label: 'Accept order', primary: true },
    { to: 'Preparing', label: 'Start preparing' },
    { to: 'Cancelled', label: 'Cancel order', danger: true },
  ],
  Confirmed: [
    { to: 'Preparing', label: 'Start preparing', primary: true },
    { to: 'Cancelled', label: 'Cancel order', danger: true },
  ],
  Preparing: [
    { to: 'Ready', label: 'Mark ready', primary: true },
    { to: 'Cancelled', label: 'Cancel order', danger: true },
  ],
  Ready: [
    { to: 'Served', label: 'Mark served', primary: true },
    { to: 'Completed', label: 'Close order' },
  ],
  Served: [{ to: 'Completed', label: 'Close order', primary: true }],
  Completed: [],
  Cancelled: [],
}

export const openStatuses: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Served']

/** Order list tabs (/orders, /orders/pending, …). */
export const orderViews = {
  all: { label: 'All Orders', statuses: [] as OrderStatus[] },
  pending: { label: 'Pending', statuses: ['Pending', 'Confirmed'] as OrderStatus[] },
  preparing: { label: 'Preparing', statuses: ['Preparing', 'Ready'] as OrderStatus[] },
  completed: { label: 'Completed', statuses: ['Served', 'Completed'] as OrderStatus[] },
  cancelled: { label: 'Cancelled', statuses: ['Cancelled'] as OrderStatus[] },
}

export type OrderView = keyof typeof orderViews
