import { Toast } from 'antd-mobile';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/queries';
import type {
  Nullable,
  PlaceRoutesResponse,
  PlaceSummariesResponse,
} from '@app-types/core';

interface UsePlaceSummariesResult {
  places: PlaceSummariesResponse;
  loading: boolean;
  error: Nullable<unknown>;
}

export function usePlaceSummaries(
  loadErrorMessage?: string,
): UsePlaceSummariesResult {
  const { data, error, isLoading } = useQuery<PlaceSummariesResponse>({
    queryKey: ['places', 'summary'],
    queryFn: () => fetchApi<PlaceSummariesResponse>('/api/v1/places'),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: 2000,
  });

  useEffect(() => {
    if (error && loadErrorMessage) {
      Toast.show({ content: loadErrorMessage, icon: 'fail' });
    }
  }, [error, loadErrorMessage]);

  return {
    places: data ?? [],
    loading: isLoading,
    error: error ?? null,
  };
}

interface UsePlaceRoutesResult {
  sourceStop: PlaceRoutesResponse['sourceStop'];
  matchingStops: PlaceRoutesResponse['matchingStops'];
  loading: boolean;
  error: Nullable<unknown>;
}

export function usePlaceRoutes(
  googlePlaceId: Nullable<string>,
  loadErrorMessage?: string,
): UsePlaceRoutesResult {
  const { data, error, isLoading } = useQuery<PlaceRoutesResponse>({
    queryKey: ['places', 'routes', googlePlaceId],
    queryFn: () =>
      fetchApi<PlaceRoutesResponse>(
        `/api/v1/places/${encodeURIComponent(googlePlaceId!)}/routes`,
      ),
    enabled: !!googlePlaceId,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: false,
  });

  useEffect(() => {
    if (error && loadErrorMessage) {
      Toast.show({ content: loadErrorMessage, icon: 'fail' });
    }
  }, [error, loadErrorMessage]);

  return {
    sourceStop: data?.sourceStop ?? null,
    matchingStops: data?.matchingStops ?? [],
    loading: isLoading,
    error: error ?? null,
  };
}
