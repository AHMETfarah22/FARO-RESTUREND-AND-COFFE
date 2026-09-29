import { HubConnectionState, type HubConnection } from '@microsoft/signalr'
import type { HubKind } from '@/features/realtime/hub'
import { subscribe } from './db'

type Handler = (...args: unknown[]) => void

/** Events of RestaurantHub's restaurant group (staff) — "orderStatus" goes to the customers following that order. */
const STAFF_EVENTS = new Set(['orderCreated', 'orderUpdated', 'notification', 'tablesChanged'])

/**
 * Stand-in for a SignalR HubConnection: the parts the pages use (start/stop, on/off, invoke('TrackOrder')),
 * fed by the demo API's events in this tab and in the other tabs of the same browser.
 */
class DemoHubConnection {
  state = HubConnectionState.Disconnected
  private readonly handlers = new Map<string, Set<Handler>>()
  private readonly tracked = new Set<string>()
  private readonly closed = new Set<() => void>()
  private unsubscribe: (() => void) | null = null
  private readonly kind: HubKind

  constructor(kind: HubKind) {
    this.kind = kind
  }

  async start() {
    this.unsubscribe = subscribe((event, payload) => this.dispatch(event, payload))
    this.state = HubConnectionState.Connected
  }

  async stop() {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.state = HubConnectionState.Disconnected
    this.closed.forEach((handler) => handler())
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }

  off(event: string, handler?: Handler) {
    if (handler) this.handlers.get(event)?.delete(handler)
    else this.handlers.delete(event)
  }

  /** RestaurantHub.TrackOrder: a QR-menu customer follows the order they placed. */
  async invoke(method: string, ...args: unknown[]) {
    if (method === 'TrackOrder') this.tracked.add(String(args[0]))
  }

  onclose(handler: () => void) {
    this.closed.add(handler)
  }

  onreconnecting() {}

  onreconnected() {}

  private dispatch(event: string, payload: unknown) {
    const relevant =
      this.kind === 'staff' ? STAFF_EVENTS.has(event) : event === 'orderStatus' && this.tracked.has((payload as { id: string }).id)
    if (!relevant) return
    this.handlers.get(event)?.forEach((handler) => (payload === undefined ? handler() : handler(payload)))
  }
}

export const createDemoHub = (kind: HubKind) => new DemoHubConnection(kind) as unknown as HubConnection
