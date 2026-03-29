import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { NavBar, SearchBar, Skeleton, Toast } from 'antd-mobile'
import { UnorderedListOutline } from 'antd-mobile-icons'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import type { RoutesResponse, Station } from '../lib/types'
import AppTabBar, {
  APP_TAB_BAR_HEIGHT,
  APP_TAB_BAR_SAFE_OFFSET,
} from './components/AppTabBar'

const StationBrowserMap = dynamic(() => import('./components/StationBrowserMap'), { ssr: false })

export default function SearchMapPage() {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const [routes, setRoutes] = useState<RoutesResponse>([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    void fetch('/api/v1/routes')
      .then(async (response) => (await response.json()) as RoutesResponse)
      .then(setRoutes)
      .catch(() => Toast.show({ content: copy.common.routeLoadError, icon: 'fail' }))
      .finally(() => setRoutesLoading(false))
  }, [copy.common.routeLoadError])

  const stations = useMemo(
    () =>
      Array.from(
        routes
          .flatMap((route) => route.stations.filter((station) => !station.is_terminal))
          .reduce<Map<string, Station>>((accumulator, station) => {
            if (!accumulator.has(station.name)) accumulator.set(station.name, station)
            return accumulator
          }, new Map())
      )
        .map(([, station]) => station)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [routes]
  )

  const filteredStations = useMemo(
    () =>
      stations.filter(station =>
        station.name.toLowerCase().includes(keyword.trim().toLowerCase())
      ),
    [keyword, stations]
  )

  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingBottom: APP_TAB_BAR_SAFE_OFFSET,
        background: 'var(--adm-color-background)',
      }}
    >
      <NavBar
        onBack={() => router.back()}
        right={
          <span
            onClick={() => {
              void router.push('/search')
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--app-color-link)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <UnorderedListOutline fontSize={16} />
            <span>{copy.search.list}</span>
          </span>
        }
      >
        {copy.search.title}
      </NavBar>

      <div
        style={{
          padding: '8px 12px 10px',
          background: 'var(--adm-color-background)',
          borderBottom: '1px solid var(--app-color-border)',
        }}
      >
        <SearchBar
          placeholder={copy.search.searchPlaceholder}
          value={keyword}
          onChange={setKeyword}
          style={{
            '--background': 'var(--adm-color-background)',
            '--border-radius': '10px',
          }}
        />
      </div>

      <div style={{ height: `calc(100dvh - 90px - ${APP_TAB_BAR_HEIGHT}px - env(safe-area-inset-bottom))` }}>
        {routesLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton.Title animated />
            <Skeleton.Paragraph lineCount={8} animated />
          </div>
        ) : (
          <StationBrowserMap
            stations={filteredStations}
            zoomInAriaLabel={copy.home.zoomInAriaLabel}
            zoomOutAriaLabel={copy.home.zoomOutAriaLabel}
            currentLocationAriaLabel={copy.home.currentLocationAriaLabel}
            currentLocationUnavailable={copy.home.currentLocationUnavailable}
            onSelect={(stationId) => {
              void router.push({
                pathname: '/stops',
                query: { stationId },
              })
            }}
          />
        )}
      </div>

      <AppTabBar />
    </div>
  )
}
