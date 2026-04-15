import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../lib/queries';
import type { ActiveRun, Nullable } from '@app-types/core';

interface UseRunStatusResult {
  activeRun: Nullable<ActiveRun>;
  loading: boolean;
  error: Nullable<unknown>;
  refresh: () => void;
}

/**
 * Poll the active run status for a single route (30s interval).
 * Returns null when no active run exists for the route.
 */
export function useRunStatus(routeCode: Nullable<string>): UseRunStatusResult {
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery<ActiveRun | null>({
    queryKey: ['run-status', routeCode],
    queryFn: () =>
      fetchApi<ActiveRun | null>(
        `/api/v1/checkin/run-status?routeCode=${encodeURIComponent(routeCode!)}`,
      ),
    enabled: !!routeCode,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    activeRun: data ?? null,
    loading: isLoading,
    error: error ?? null,
    refresh: () => {
      queryClient
        .invalidateQueries({ queryKey: ['run-status', routeCode] })
        .catch(() => {});
    },
  };
}
