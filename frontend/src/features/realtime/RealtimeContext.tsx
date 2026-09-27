import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { env } from '@/config/env'
import { tokenStore } from '@/lib/api'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

interface RealtimeState {
  connection: HubConnection | null
  status: RealtimeStatus
}

const RealtimeContext = createContext<RealtimeState>({ connection: null, status: 'disconnected' })

export const HUB_URL = `${env.apiBaseUrl}/hubs/restaurant`

/**
 * One SignalR connection per signed-in session. Staff are placed in their restaurant group by the
 * server and receive: orderCreated, orderUpdated, notification, tablesChanged.
 */
export function RealtimeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [connection, setConnection] = useState<HubConnection | null>(null)
  const [status, setStatus] = useState<RealtimeStatus>('disconnected')

  useEffect(() => {
    if (!enabled) return

    const hub = new HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => tokenStore.get() ?? '' })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
      .configureLogging(LogLevel.Warning)
      .build()

    let cancelled = false
    // Ignore events from a connection that is being replaced (e.g. its late onclose after a remount).
    hub.onreconnecting(() => !cancelled && setStatus('reconnecting'))
    hub.onreconnected(() => !cancelled && setStatus('connected'))
    hub.onclose(() => !cancelled && setStatus('disconnected'))

    let retry: ReturnType<typeof setTimeout> | undefined
    let starting: Promise<void> = Promise.resolve()

    const start = () => {
      setStatus('connecting')
      starting = hub
        .start()
        .then(() => {
          if (!cancelled) setStatus('connected')
        })
        .catch(() => {
          if (cancelled) return
          setStatus('disconnected')
          retry = setTimeout(start, 5000) // API not up yet — keep trying
        })
    }

    setConnection(hub)
    start()

    return () => {
      cancelled = true
      clearTimeout(retry)
      setConnection(null)
      // Let an in-flight negotiation finish before stopping (avoids "stopped during negotiation" errors).
      void starting.finally(() => {
        if (hub.state !== HubConnectionState.Disconnected) void hub.stop()
      })
    }
  }, [enabled])

  return <RealtimeContext.Provider value={{ connection, status }}>{children}</RealtimeContext.Provider>
}

export function useRealtimeStatus() {
  return useContext(RealtimeContext).status
}

/** Subscribes to a hub event for the lifetime of the component. The handler may change freely. */
export function useRealtimeEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const { connection } = useContext(RealtimeContext)
  const handlerRef = useRef(handler)
  useLayoutEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!connection) return
    const listener = (payload: T) => handlerRef.current(payload)
    connection.on(event, listener)
    return () => connection.off(event, listener)
  }, [connection, event])
}
