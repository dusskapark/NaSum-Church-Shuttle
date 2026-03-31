import { Toast } from 'antd-mobile'
import { useEffect } from 'react'
import useSWR from 'swr'
import type { Nullable, RoutesResponse } from '../lib/types'

interface UseRoutesResult {
  routes: RoutesResponse
  loading: boolean
  error: Nullable<unknown>
}

const ROUTES_ENDPOINT = '/api/v1/routes'

const fetchRoutes = async (url: string): Promise<RoutesResponse> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Failed to load routes')
  }

  return (await response.json()) as RoutesResponse
}

export function useRoutes(routeLoadErrorMessage?: string): UseRoutesResult {
  const { data, error, isLoading } = useSWR<RoutesResponse>(ROUTES_ENDPOINT, fetchRoutes, {
    dedupingInterval: 300000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    errorRetryCount: 2,
    errorRetryInterval: 2000,
  })

  useEffect(() => {
    if (error && routeLoadErrorMessage) {
      Toast.show({ content: routeLoadErrorMessage, icon: 'fail' })
    }
  }, [error, routeLoadErrorMessage])

  return {
    routes: data ?? [],
    loading: isLoading,
    error: error ?? null,
  }
}
