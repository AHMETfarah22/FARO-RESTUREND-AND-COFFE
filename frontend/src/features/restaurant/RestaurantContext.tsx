import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import type { Restaurant } from '@/types/api'

interface RestaurantState {
  restaurant: Restaurant | null
  currency: string
  money: (value: number, options?: { compact?: boolean }) => string
  setRestaurant: (restaurant: Restaurant) => void
  refresh: () => void
}

const RestaurantContext = createContext<RestaurantState | null>(null)

/** Loads the signed-in user's restaurant once (currency, tax, settings) for the whole portal. */
export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api
      .get<Restaurant>('/restaurants/current', { signal: controller.signal })
      .then((r) => setRestaurant(r.data))
      .catch(() => {
        /* pages show their own errors; currency falls back to TRY */
      })
    return () => controller.abort()
  }, [version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const currency = restaurant?.currency ?? 'TRY'

  const value = useMemo<RestaurantState>(
    () => ({
      restaurant,
      currency,
      money: (v, o) => formatMoney(v, currency, o),
      setRestaurant,
      refresh,
    }),
    [restaurant, currency, refresh],
  )

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>
}

export function useRestaurant() {
  const ctx = useContext(RestaurantContext)
  if (!ctx) throw new Error('useRestaurant must be used inside <RestaurantProvider>')
  return ctx
}
