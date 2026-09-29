import { HubConnectionBuilder, LogLevel, type HubConnection } from '@microsoft/signalr'
import { env } from '@/config/env'
import { tokenStore } from '@/lib/api'

const HUB_URL = `${env.apiBaseUrl}/hubs/restaurant`

/** 'staff': signed-in staff (restaurant group). 'guest': anonymous QR-menu customer following its own orders. */
export type HubKind = 'staff' | 'guest'

let override: ((kind: HubKind) => HubConnection) | null = null

/** Lets the demo build swap SignalR for its in-browser hub. */
export function setHubFactory(create: (kind: HubKind) => HubConnection) {
  override = create
}

/** A new (not yet started) connection to the restaurant hub. */
export function createHub(kind: HubKind): HubConnection {
  if (override) return override(kind)
  if (kind === 'guest') return new HubConnectionBuilder().withUrl(HUB_URL).withAutomaticReconnect().configureLogging(LogLevel.None).build()
  return new HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => tokenStore.get() ?? '' })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 20000, 30000])
    .configureLogging(LogLevel.Warning)
    .build()
}
