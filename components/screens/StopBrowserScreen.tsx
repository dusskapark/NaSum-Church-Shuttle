import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { IndexBar, List, NavBar, SearchBar, Segmented, Skeleton, Toast } from 'antd-mobile'
import { EnvironmentOutline, UnorderedListOutline } from 'antd-mobile-icons'
import TabPageLayout from '../layout/TabPageLayout'
import { useRoutes } from '../../hooks/useRoutes'
import { useAppSettings } from '../../lib/app-settings'
import { getCopy } from '../../lib/copy'
import {
  filterStationsByKeyword,
  getDistanceInKm,
  getUniqueStations,
  groupStationsByIndex,
  sortStationIndexes,
  sortStationsByDistance,
  type Coordinates,
} from '../../lib/routeSelectors'

const StationBrowserMap = dynamic(() => import('../maps/StationBrowserMap'), { ssr: false })

type StopBrowserViewMode = 'list' | 'map'
type SortMode = 'alphabetical' | 'distance'

interface StopBrowserScreenProps {
  viewMode: StopBrowserViewMode
}

const navActionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--app-color-link)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
}

export default function StopBrowserScreen({ viewMode }: StopBrowserScreenProps) {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const { routes, loading: routesLoading } = useRoutes(copy.common.routeLoadError)

  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical')
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null)
  const locationRequestedRef = useRef(false)
  const locationNoticeShownRef = useRef(false)

  useEffect(() => {
    if (viewMode !== 'list') {
      return
    }

    if (sortMode !== 'distance' || coordinates || locationRequestedRef.current || typeof window === 'undefined') {
      return
    }

    if (!('geolocation' in navigator)) {
      if (!locationNoticeShownRef.current) {
        Toast.show({ content: copy.search.distanceUnavailable, icon: 'fail' })
        locationNoticeShownRef.current = true
      }

      return
    }

    locationRequestedRef.current = true

    navigator.geolocation.getCurrentPosition(
      position => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        if (!locationNoticeShownRef.current) {
          Toast.show({ content: copy.search.distanceUnavailable, icon: 'fail' })
          locationNoticeShownRef.current = true
        }

        setSortMode('alphabetical')
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    )
  }, [coordinates, copy.search.distanceUnavailable, sortMode, viewMode])

  const stations = useMemo(() => getUniqueStations(routes), [routes])
  const filteredStations = useMemo(
    () => filterStationsByKeyword(stations, keyword),
    [keyword, stations]
  )
  const distanceSortedStations = useMemo(
    () => sortStationsByDistance(filteredStations, coordinates),
    [coordinates, filteredStations]
  )
  const groupedStations = useMemo(
    () => groupStationsByIndex(filteredStations),
    [filteredStations]
  )
  const stationIndexes = useMemo(
    () => sortStationIndexes(groupedStations),
    [groupedStations]
  )
  const visibleStations = sortMode === 'distance' ? distanceSortedStations : filteredStations

  const nextViewHref = viewMode === 'list' ? '/search-map' : '/search'
  const nextViewLabel = viewMode === 'list' ? copy.search.map : copy.search.list
  const NextViewIcon = viewMode === 'list' ? EnvironmentOutline : UnorderedListOutline

  return (
    <TabPageLayout
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <NavBar
        onBack={() => {
          void router.push('/')
        }}
        right={
          <span
            onClick={() => {
              void router.push(nextViewHref)
            }}
            style={navActionStyle}
          >
            <NextViewIcon fontSize={16} />
            <span>{nextViewLabel}</span>
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

      {viewMode === 'list' ? (
        <div
          style={{
            padding: '10px 12px',
            background: 'var(--adm-color-background)',
            borderBottom: '1px solid var(--app-color-border)',
          }}
        >
          <Segmented
            block
            value={sortMode}
            onChange={value => {
              setSortMode(value as SortMode)
            }}
            options={[
              { label: copy.search.alphabetical, value: 'alphabetical' },
              { label: copy.search.distance, value: 'distance' },
            ]}
          />
        </div>
      ) : null}

      <div style={{ flex: 1, minHeight: 0 }}>
        {routesLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton.Title animated />
            <Skeleton.Paragraph lineCount={8} animated />
          </div>
        ) : viewMode === 'map' ? (
          <StationBrowserMap
            stations={filteredStations}
            zoomInAriaLabel={copy.home.zoomInAriaLabel}
            zoomOutAriaLabel={copy.home.zoomOutAriaLabel}
            currentLocationAriaLabel={copy.home.currentLocationAriaLabel}
            currentLocationUnavailable={copy.home.currentLocationUnavailable}
            onSelect={stationId => {
              void router.push({
                pathname: '/stops',
                query: { stationId },
              })
            }}
          />
        ) : sortMode === 'distance' ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <List>
              {visibleStations.map(station => (
                <List.Item
                  key={station.id}
                  description={
                    coordinates
                      ? `${getDistanceInKm(coordinates, { lat: station.lat, lng: station.lng }).toFixed(1)} km`
                      : undefined
                  }
                  onClick={() => {
                    void router.push({
                      pathname: '/stops',
                      query: { stationId: station.id },
                    })
                  }}
                >
                  {station.name}
                </List.Item>
              ))}
            </List>
          </div>
        ) : (
          <IndexBar style={{ height: '100%', '--sticky-offset-top': '0px' }}>
            {stationIndexes.map(index => (
              <IndexBar.Panel key={index} index={index} title={index} brief={index}>
                <List>
                  {groupedStations[index].map(station => (
                    <List.Item
                      key={station.id}
                      onClick={() => {
                        void router.push({
                          pathname: '/stops',
                          query: { stationId: station.id },
                        })
                      }}
                    >
                      {station.name}
                    </List.Item>
                  ))}
                </List>
              </IndexBar.Panel>
            ))}
          </IndexBar>
        )}
      </div>
    </TabPageLayout>
  )
}
