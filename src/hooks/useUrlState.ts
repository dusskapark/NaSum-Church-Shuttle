import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { logDebug, logError } from '../lib/logger';

interface UrlStateOptions<T> {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

/**
 * URL state sync hook.
 * Syncs component state with the URL query string.
 */
export function useUrlState<T extends string | number | boolean | null>(
  options: UrlStateOptions<T>,
): [T, (value: T) => void] {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { key, defaultValue, serialize, deserialize } = options;
  const queryValue = searchParams.get(key);
  let resolvedState = defaultValue;

  if (queryValue !== null) {
    try {
      resolvedState = deserialize ? deserialize(queryValue) : (queryValue as T);
    } catch {
      resolvedState = defaultValue;
    }
  }

  const updateState = (newValue: T) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newValue === defaultValue || newValue === null || newValue === '') {
      params.delete(key);
    } else {
      const serializedValue = serialize
        ? serialize(newValue)
        : String(newValue);
      params.set(key, serializedValue);
    }

    const newUrl = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

    logDebug(`URL Update [${key}]`, { newValue, newUrl });

    try {
      navigate(newUrl);
      logDebug(`URL updated successfully [${key}]`);
    } catch (error) {
      logError(`URL update failed [${key}]`, error);
    }
  };

  return [resolvedState, updateState];
}

/**
 * Dedicated hook for managing home page route/stop state.
 */
export function useHomeUrlState() {
  const [selectedRoute, setSelectedRoute] = useUrlState({
    key: 'route',
    defaultValue: null as string | null,
  });

  const [selectedStation, setSelectedStation] = useUrlState({
    key: 'station',
    defaultValue: null as string | null,
  });

  const selectRouteAndStation = (
    routeId: string | null,
    stationId: string | null,
  ) => {
    logDebug('Route/Station Update', { routeId, stationId });
    setSelectedRoute(routeId);
    setSelectedStation(stationId);
  };

  const clearSelection = () => {
    setSelectedRoute(null);
    setSelectedStation(null);
  };

  return {
    selectedRoute,
    selectedStation,
    setSelectedRoute,
    setSelectedStation,
    selectRouteAndStation,
    clearSelection,
  };
}

/**
 * Dedicated hook for managing search page state.
 */
export function useSearchUrlState() {
  const [query, setQuery] = useUrlState({
    key: 'q',
    defaultValue: '' as string,
  });

  const [view, setView] = useUrlState({
    key: 'view',
    defaultValue: 'list' as 'list' | 'map',
    serialize: (value) => value,
    deserialize: (value) => (value === 'map' ? 'map' : 'list'),
  });

  return {
    query,
    setQuery,
    view,
    setView,
  };
}
