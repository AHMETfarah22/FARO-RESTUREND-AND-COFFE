import { useParams } from 'react-router'
import { orderViews, type OrderView } from '@/features/orders/workflow'
import { OrderDetailPage } from './OrderDetailPage'
import { OrdersPage } from './OrdersPage'

/** /orders/:param — a list view (pending, preparing, completed, cancelled) or an order id. */
export function OrderRoute() {
  const { param = '' } = useParams()
  return param in orderViews ? <OrdersPage view={param as OrderView} /> : <OrderDetailPage id={param} />
}
