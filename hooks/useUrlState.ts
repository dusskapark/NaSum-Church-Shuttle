import { useRouter } from 'next/router'
import { logDebug, logError } from '../lib/logger'

interface UrlStateOptions<T> {
  key: string
  defaultValue: T
  serialize?: (value: T) => string
  deserialize?: (value: string) => T
}

/**
 * URL 상태 동기화 훅
 * 컴포넌트 상태와 URL 쿼리스트링을 동기화합니다.
 */
export function useUrlState<T extends string | number | boolean | null>(
  options: UrlStateOptions<T>
): [T, (value: T) => void] {
  const router = useRouter()
  const { key, defaultValue, serialize, deserialize } = options
  const queryValue = router.query[key]
  let resolvedState = defaultValue

  if (typeof queryValue === 'string') {
    try {
      resolvedState = deserialize ? deserialize(queryValue) : (queryValue as T)
    } catch {
      resolvedState = defaultValue
    }
  } else if (router.isReady) {
    resolvedState = defaultValue
  }

  // 상태 변경 시 URL 업데이트
  const updateState = (newValue: T) => {
    if (!router.isReady) return

    // Build complete URL with all query parameters
    const query = { ...router.query }

    if (newValue === defaultValue || newValue === null || newValue === '') {
      delete query[key]
    } else {
      const serializedValue = serialize ? serialize(newValue) : String(newValue)
      query[key] = serializedValue
    }

    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v && v !== defaultValue) params.set(k, String(v))
    })
    const newUrl = `${router.pathname}${params.toString() ? '?' + params.toString() : ''}`

    logDebug(`URL Update [${key}]`, { newValue, newUrl })

    void router.push(newUrl, undefined, { shallow: false }).then(() => {
      logDebug(`URL updated successfully [${key}]`)
    }).catch((error) => {
      logError(`URL update failed [${key}]`, error)
    })
  }

  return [resolvedState, updateState]
}

/**
 * 홈페이지 라우트/정류장 상태 관리를 위한 전용 훅
 */
export function useHomeUrlState() {
  const [selectedRoute, setSelectedRoute] = useUrlState({
    key: 'route',
    defaultValue: null as string | null,
  })

  const [selectedStation, setSelectedStation] = useUrlState({
    key: 'station',
    defaultValue: null as string | null,
  })

  const selectRouteAndStation = (routeId: string | null, stationId: string | null) => {
    logDebug('Route/Station Update', { routeId, stationId })
    setSelectedRoute(routeId)
    setSelectedStation(stationId)
  }

  const clearSelection = () => {
    setSelectedRoute(null)
    setSelectedStation(null)
  }

  return {
    selectedRoute,
    selectedStation,
    setSelectedRoute,
    setSelectedStation,
    selectRouteAndStation,
    clearSelection,
  }
}

/**
 * 검색 페이지 상태 관리를 위한 전용 훅
 */
export function useSearchUrlState() {
  const [query, setQuery] = useUrlState({
    key: 'q',
    defaultValue: '' as string,
  })

  const [view, setView] = useUrlState({
    key: 'view',
    defaultValue: 'list' as 'list' | 'map',
    serialize: (value) => value,
    deserialize: (value) => (value === 'map' ? 'map' : 'list'),
  })

  return {
    query,
    setQuery,
    view,
    setView,
  }
}
