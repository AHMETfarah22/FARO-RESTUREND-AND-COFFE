import { useEffect, useLayoutEffect, useRef } from 'react'
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { HUB_URL } from '@/features/realtime/RealtimeContext'

/**
 * Anonymous SignalR subscription for the QR-menu customer: joins the group of each tracked order
 * and calls `onChange` when its status changes. A slow poll (in the page) covers dropped connections.
 */
export function useOrderTracking(orderIds: string[], onChange: (orderId: string) => void) {
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    onChangeRef.current = onChange
  })
  const key = orderIds.join(',')

  useEffect(() => {
    if (!key) return
    const ids = key.split(',')
    const hub = new HubConnectionBuilder().withUrl(HUB_URL).withAutomaticReconnect().configureLogging(LogLevel.None).build()

    const join = () => Promise.all(ids.map((id) => hub.invoke('TrackOrder', id))).catch(() => undefined)
    hub.on('orderStatus', (payload: { id: string }) => onChangeRef.current(payload.id))
    hub.onreconnected(() => void join())

    let cancelled = false
    const starting = hub
      .start()
      .then(() => {
        if (!cancelled) void join()
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
      // Stop only after negotiation completes (avoids "stopped during negotiation" errors).
      void starting.finally(() => {
        if (hub.state !== HubConnectionState.Disconnected) void hub.stop()
      })
    }
  }, [key])
}
