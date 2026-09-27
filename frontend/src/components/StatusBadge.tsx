import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { orderStatusLabel, paymentStatusLabel, reservationStatusLabel, tableStatusLabel } from '@/lib/labels'
import type { OrderStatus, PaymentStatus, ReservationStatus, TableStatus } from '@/types/api'

const orderTones: Record<OrderStatus, BadgeTone> = {
  Pending: 'warning',
  Confirmed: 'neutral',
  Preparing: 'dark',
  Ready: 'success',
  Served: 'neutral',
  Completed: 'neutral',
  Cancelled: 'danger',
}

const tableTones: Record<TableStatus, BadgeTone> = {
  Available: 'success',
  Occupied: 'dark',
  Reserved: 'warning',
  Cleaning: 'neutral',
  Disabled: 'danger',
}

const paymentTones: Record<PaymentStatus, BadgeTone> = {
  Pending: 'warning',
  Paid: 'success',
  Failed: 'danger',
  Refunded: 'neutral',
}

const reservationTones: Record<ReservationStatus, BadgeTone> = {
  Pending: 'warning',
  Confirmed: 'dark',
  Arrived: 'success',
  Completed: 'neutral',
  Cancelled: 'danger',
}

function Dot() {
  return <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={orderTones[status]}><Dot />{orderStatusLabel(status)}</Badge>
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  return <Badge tone={tableTones[status]}><Dot />{tableStatusLabel(status)}</Badge>
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTones[status]}><Dot />{paymentStatusLabel(status)}</Badge>
}

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge tone={reservationTones[status]}><Dot />{reservationStatusLabel(status)}</Badge>
}
