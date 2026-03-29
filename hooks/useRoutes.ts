import { Toast } from 'antd-mobile'
import { useEffect, useState } from 'react'
import type { Nullable, RoutesResponse } from '../lib/types'

interface UseRoutesResult {
  routes: RoutesResponse
  loading: boolean
  error: Nullable<unknown>
}

export function useRoutes(routeLoadErrorMessage?: string): UseRoutesResult {
  const [routes, setRoutes] = useState<RoutesResponse>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Nullable<unknown>>(null)

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const response = await fetch('/api/v1/routes')

        if (!response.ok) {
          throw new Error('Failed to load routes')
        }

        const data = (await response.json()) as RoutesResponse

        if (!cancelled) {
          setRoutes(data)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError)

          if (routeLoadErrorMessage) {
            Toast.show({ content: routeLoadErrorMessage, icon: 'fail' })
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [routeLoadErrorMessage])

  return { routes, loading, error }
}
