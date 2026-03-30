import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Button, IndexBar, List, SearchBar, Segmented, Skeleton, Space, Toast } from 'antd-mobile'
import { EnvironmentOutline, UnorderedListOutline } from 'antd-mobile-icons'
import Layout from '../components/Layout'
import { StationBrowserMap } from '../components/Maps'
import { useRoutes } from '../hooks/useRoutes'
import { useSearchUrlState } from '../hooks/useUrlState'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import {
  filterStationsByKeyword,
  getDistanceInKm,
  getUniqueStations,
  groupStationsByIndex,
  sortStationIndexes,
  sortStationsByDistance,
  type Coordinates,
} from '../lib/routeSelectors'

type ViewMode = 'list' | 'map'
type SortMode = 'alphabetical' | 'distance'

export default function SearchPage() {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const { routes, loading: routesLoading } = useRoutes(copy.common.routeLoadError)

  const { query: keyword, setQuery: setKeyword, view: viewMode, setView: setViewMode } = useSearchUrlState()
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

  const nextViewLabel = viewMode === 'list' ? copy.search.map : copy.search.list
  const NextViewIcon = viewMode === 'list' ? EnvironmentOutline : UnorderedListOutline

  return (
    <>
      <Head>
        <title>{copy.search.title}</title>
      </Head>
      <Layout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '8px 12px 10px',
            background: 'var(--adm-color-background)',
            borderBottom: '1px solid var(--app-color-border)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchBar
              placeholder={copy.search.searchPlaceholder}
              value={keyword}
              onChange={setKeyword}
              style={{
                '--background': 'var(--adm-color-background)',
                '--border-radius': '10px',
                flex: 1,
              }}
            />
            <Button
              fill="none"
              size="small"
              onClick={() => {
                setViewMode(viewMode === 'list' ? 'map' : 'list')
              }}
              style={{
                color: 'var(--app-color-link)',
                padding: '8px 12px',
                minWidth: 'auto',
              }}
            >
              <Space align="center" style={{ gap: 6 }}>
                <NextViewIcon fontSize={16} />
                <span>{nextViewLabel}</span>
              </Space>
            </Button>
          </div>
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

        <div style={{
          flex: 1,
          minHeight: 0,
        }}>
          {routesLoading ? (
            <div style={{ padding: 16 }}>
              <Skeleton.Title animated />
              <Skeleton.Paragraph lineCount={8} animated />
            </div>
          ) : viewMode === 'map' ? (
            <StationBrowserMap
              places={filteredStations}
              currentLocationAriaLabel={copy.home.currentLocationAriaLabel}
              currentLocationUnavailable={copy.home.currentLocationUnavailable}
              onSelect={googlePlaceId => {
                void router.push({
                  pathname: '/stops',
                  query: { placeId: googlePlaceId },
                })
              }}
            />
          ) : sortMode === 'distance' ? (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <List>
                {visibleStations.map(station => (
                  <List.Item
                    key={station.googlePlaceId}
                    description={
                      coordinates
                        ? `${getDistanceInKm(coordinates, { lat: station.lat, lng: station.lng }).toFixed(1)} km`
                        : undefined
                    }
                    onClick={() => {
                      void router.push({
                        pathname: '/stops',
                        query: { placeId: station.googlePlaceId },
                      })
                    }}
                  >
                    {station.name}
                  </List.Item>
                ))}
              </List>
              {/* Distance 모드용 하단 여백 */}
              <div style={{ height: 16 }} />
            </div>
          ) : (
            <IndexBar style={{
              height: '100%',
              '--sticky-offset-top': '0px',
              paddingBottom: 16,
            }}>
              {stationIndexes.map(index => (
                <IndexBar.Panel key={index} index={index} title={index} brief={index}>
                  <List>
                    {groupedStations[index].map(station => (
                      <List.Item
                        key={station.googlePlaceId}
                        onClick={() => {
                          void router.push({
                            pathname: '/stops',
                            query: { placeId: station.googlePlaceId },
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
      </div>
    </Layout>
    </>
  )
}
