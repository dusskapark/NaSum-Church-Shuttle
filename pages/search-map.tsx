import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { NavBar, Skeleton, Toast } from 'antd-mobile'
import { getCopy } from '../lib/copy'
import type { RoutesResponse, Station } from '../lib/types'

const StationBrowserMap = dynamic(() => import('./components/StationBrowserMap'), { ssr: false })

export default function SearchMapPage() {
  const router = useRouter()
  const copy = getCopy('en')
  const [routes, setRoutes] = useState<RoutesResponse>([])
  const [routesLoading, setRoutesLoading] = useState(true)

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

  return (
    <div style={{ minHeight: '100dvh', background: '#fff' }}>
      <NavBar onBack={() => router.back()}>{copy.search.mapTitle}</NavBar>

      <div
        style={{
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: '#6b7280',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        {copy.search.mapHint}
      </div>

      <div style={{ height: 'calc(100dvh - 90px)' }}>
        {routesLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton.Title animated />
            <Skeleton.Paragraph lineCount={8} animated />
          </div>
        ) : (
          <StationBrowserMap
            stations={stations}
            onSelect={(stationId) => {
              void router.push({
                pathname: '/stops',
                query: { stationId },
              })
            }}
          />
        )}
      </div>
    </div>
  )
}
