import { useSyncExternalStore } from 'react'

/**
 * Which layout the customer pages use. Phones get a one-column list made for thumbs,
 * tablets a card grid, computers a three-column page with the order always visible.
 */
export type Device = 'phone' | 'tablet' | 'desktop'

const TABLET = '(min-width: 640px)'
const DESKTOP = '(min-width: 1024px)'

function current(): Device {
  if (window.matchMedia(DESKTOP).matches) return 'desktop'
  if (window.matchMedia(TABLET).matches) return 'tablet'
  return 'phone'
}

function subscribe(onChange: () => void) {
  const queries = [window.matchMedia(TABLET), window.matchMedia(DESKTOP)]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

export function useDevice(): Device {
  return useSyncExternalStore(subscribe, current, () => 'phone')
}
