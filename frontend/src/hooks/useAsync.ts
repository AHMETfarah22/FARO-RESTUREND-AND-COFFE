import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getErrorMessage } from '@/lib/api'

interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * Runs an async loader whenever `deps` change and exposes loading / error / data,
 * plus `reload` (refetch, keeps current data visible) and `setData` (local updates).
 */
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true })
  const [version, setVersion] = useState(0)
  const loaderRef = useRef(loader)
  useLayoutEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    const controller = new AbortController()

    loaderRef.current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((s) => ({ data: s.data, error: getErrorMessage(error), loading: false }))
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    setVersion((v) => v + 1)
  }, [])

  const setData = useCallback((update: T | ((current: T | null) => T)) => {
    setState((s) => ({
      ...s,
      data: typeof update === 'function' ? (update as (c: T | null) => T)(s.data) : update,
    }))
  }, [])

  return { ...state, reload, setData }
}
