import { useCallback, useEffect, useRef, useState } from 'react'
import { publicMenuApi } from '@/lib/endpoints'
import { playChime } from '@/lib/sound'
import type { OrderStatus, PublicOrderStatus } from '@/types/api'
import { showLocalNotification } from './customerPush'
import { customerTexts } from './customerText'
import { useOrderTracking } from './useOrderTracking'

const SEEN_READY_KEY = 'faro.myorders.readySeen'
const ACTIVE: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Ready']

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_READY_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_READY_KEY, JSON.stringify(ids.slice(-50)))
  } catch {
    /* ignore */
  }
}

/**
 * Live status of the customer's orders plus the "your order is ready" alert.
 * Updates arrive over SignalR; a slow poll covers dropped connections and sleeping phones.
 */
export function useCustomerOrders(orderIds: string[], onMissing: (id: string) => void) {
  const [orders, setOrders] = useState<Record<string, PublicOrderStatus>>({})
  const [readyAlert, setReadyAlert] = useState<PublicOrderStatus | null>(null)
  const onMissingRef = useRef(onMissing)
  const ordersRef = useRef(orders)
  useEffect(() => {
    onMissingRef.current = onMissing
    ordersRef.current = orders
  })

  const announce = useCallback((order: PublicOrderStatus) => {
    const seen = readSeen()
    if (order.status !== 'Ready' || seen.includes(order.id)) return
    writeSeen([...seen, order.id])
    setReadyAlert(order)
    playChime()
    navigator.vibrate?.([300, 120, 300, 120, 500])
    const t = customerTexts()
    if (document.visibilityState === 'hidden')
      void showLocalNotification(t.localReadyTitle, t.localReadyBody(order.number, order.tableName), `order-${order.id}`)
  }, [])

  const refresh = useCallback(
    (id: string) =>
      publicMenuApi
        .orderStatus(id)
        .then((order) => {
          setOrders((m) => ({ ...m, [id]: order }))
          announce(order)
        })
        .catch((err: { response?: { status?: number } }) => {
          if (err.response?.status === 404) onMissingRef.current(id)
        }),
    [announce],
  )

  const key = orderIds.join(',')
  useEffect(() => {
    if (!key) return
    const ids = key.split(',')
    ids.forEach((id) => void refresh(id))
    const timer = setInterval(() => {
      // Only poll orders that can still change.
      const current = ordersRef.current
      ids.filter((id) => !current[id] || ACTIVE.includes(current[id].status)).forEach((id) => void refresh(id))
    }, 20_000)
    const onVisible = () => document.visibilityState === 'visible' && ids.forEach((id) => void refresh(id))
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, refresh])

  useOrderTracking(orderIds, (id) => void refresh(id))

  const active = orderIds.filter((id) => orders[id] && ACTIVE.includes(orders[id].status))

  return { orders, activeCount: active.length, readyAlert, dismissReady: () => setReadyAlert(null) }
}
