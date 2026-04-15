import { Toast } from 'antd-mobile';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/queries';
import type { Nullable, RoutesResponse } from '@app-types/core';

interface UseRoutesResult {
  routes: RoutesResponse;
  loading: boolean;
  error: Nullable<unknown>;
}

export function useRoutes(routeLoadErrorMessage?: string): UseRoutesResult {
  const { data, error, isLoading } = useQuery<RoutesResponse>({
    queryKey: ['routes'],
    queryFn: () => fetchApi<RoutesResponse>('/api/v1/routes'),
    refetchInterval: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 2000,
  });

  useEffect(() => {
    if (error && routeLoadErrorMessage) {
      Toast.show({ content: routeLoadErrorMessage, icon: 'fail' });
    }
  }, [error, routeLoadErrorMessage]);

  return {
    routes: data ?? [],
    loading: isLoading,
    error: error ?? null,
  };
}
