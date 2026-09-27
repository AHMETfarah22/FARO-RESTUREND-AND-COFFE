import { useCallback, useEffect, useState } from 'react'
import type { PublicMenuProduct } from '@/types/api'

export interface CartLine {
  product: Pick<PublicMenuProduct, 'id' | 'name' | 'price' | 'imageUrl'>
  quantity: number
  notes: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode — cart lives in memory only */
  }
}

/** Per-table cart, kept in the browser so a refresh doesn't lose it. */
export function useCart(tableId: string) {
  const key = `faro.cart.${tableId}`
  const [lines, setLines] = useState<CartLine[]>(() => read(key, []))

  useEffect(() => write(key, lines), [key, lines])

  const add = useCallback((product: CartLine['product']) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.product.id === product.id)
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l))
      return [...ls, { product, quantity: 1, notes: '' }]
    })
  }, [])

  /** Adds several portions at once (from the product sheet); one line per product, notes are combined. */
  const addMany = useCallback((product: CartLine['product'], quantity: number, notes: string) => {
    const note = notes.trim()
    setLines((ls) => {
      const existing = ls.find((l) => l.product.id === product.id)
      if (!existing) return [...ls, { product, quantity: Math.min(20, quantity), notes: note }]
      const combined = !note || existing.notes.includes(note) ? existing.notes : [existing.notes, note].filter(Boolean).join('; ')
      return ls.map((l) => (l === existing ? { ...l, quantity: Math.min(20, l.quantity + quantity), notes: combined.slice(0, 200) } : l))
    })
  }, [])

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setLines((ls) => (quantity <= 0 ? ls.filter((l) => l.product.id !== productId) : ls.map((l) => (l.product.id === productId ? { ...l, quantity: Math.min(20, quantity) } : l))))
  }, [])

  const setNotes = useCallback((productId: string, notes: string) => {
    setLines((ls) => ls.map((l) => (l.product.id === productId ? { ...l, notes } : l)))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const count = lines.reduce((s, l) => s + l.quantity, 0)
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.product.price, 0)

  return { lines, add, addMany, setQuantity, setNotes, clear, count, subtotal }
}

export interface TrackedOrder {
  id: string
  tableId: string
  placedAt: string
}

const TRACKED_KEY = 'faro.myorders'
const MAX_TRACKED = 20

/**
 * Orders placed from this phone (any table), newest first — the customer's "My orders" list.
 * Kept in the browser only; no login needed.
 */
export function useTrackedOrders() {
  const [orders, setOrders] = useState<TrackedOrder[]>(() => read(TRACKED_KEY, []))
  useEffect(() => write(TRACKED_KEY, orders), [orders])

  const track = useCallback(
    (id: string, tableId: string) =>
      setOrders((list) => [{ id, tableId, placedAt: new Date().toISOString() }, ...list.filter((o) => o.id !== id)].slice(0, MAX_TRACKED)),
    [],
  )
  const forget = useCallback((id: string) => setOrders((list) => list.filter((o) => o.id !== id)), [])

  return { orders, ids: orders.map((o) => o.id), track, forget }
}
