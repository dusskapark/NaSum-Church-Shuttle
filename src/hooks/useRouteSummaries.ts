import { Toast } from 'antd-mobile';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/queries';
import type { Nullable, RouteSummariesResponse } from '@app-types/core';

interface UseRouteSummariesResult {
  routes: RouteSummariesResponse;
  loading: boolean;
  error: Nullable<unknown>;
}

export function useRouteSummaries(
  routeLoadErrorMessage?: string,
): UseRouteSummariesResult {
  const { data, error, isLoading } = useQuery<RouteSummariesResponse>({
    queryKey: ['routes', 'summary'],
    queryFn: () => fetchApi<RouteSummariesResponse>('/api/v1/routes/summary'),
    staleTime: 300_000,
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
