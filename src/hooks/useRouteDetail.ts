import { Toast } from 'antd-mobile';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/queries';
import type { Nullable, RouteDetailResponse } from '@app-types/core';

interface UseRouteDetailResult {
  route: Nullable<RouteDetailResponse>;
  loading: boolean;
  error: Nullable<unknown>;
}

export function useRouteDetail(
  routeCode: Nullable<string>,
  routeLoadErrorMessage?: string,
): UseRouteDetailResult {
  const { data, error, isLoading } = useQuery<RouteDetailResponse>({
    queryKey: ['routes', 'detail', routeCode],
    queryFn: () =>
      fetchApi<RouteDetailResponse>(
        `/api/v1/routes/${encodeURIComponent(routeCode!)}`,
      ),
    enabled: !!routeCode,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: false,
  });

  useEffect(() => {
    if (error && routeLoadErrorMessage) {
      Toast.show({ content: routeLoadErrorMessage, icon: 'fail' });
    }
  }, [error, routeLoadErrorMessage]);

  return {
    route: data ?? null,
    loading: isLoading,
    error: error ?? null,
  };
}
