import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { IndexBar, List, NavBar, SearchBar, Segmented, Skeleton, Toast, Button } from 'antd-mobile'
import { TravelOutline } from 'antd-mobile-icons'
import { getCopy } from '../lib/copy'
import type { Nullable, RoutesResponse, Station } from '../lib/types'

type SortMode = 'alphabetical' | 'distance'
type Coordinates = { lat: number; lng: number }

function getStationIndex(name: string): string {
  const firstChar = name.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(firstChar) ? firstChar : '#'
}

type StationGroups = Record<string, Station[]>

function getDistanceInKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function StationFinder() {
  const router = useRouter()
  const copy = getCopy('en')

  const [routes, setRoutes] = useState<RoutesResponse>([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical')
  const [coordinates, setCoordinates] = useState<Nullable<Coordinates>>(null)
  const locationRequestedRef = useRef(false)
  const locationNoticeShownRef = useRef(false)

  useEffect(() => {
    void fetch('/api/v1/routes')
      .then(async (response) => (await response.json()) as RoutesResponse)
      .then(setRoutes)
      .catch(() => Toast.show({ content: copy.common.routeLoadError, icon: 'fail' }))
      .finally(() => setRoutesLoading(false))
  }, [copy.common.routeLoadError])

  useEffect(() => {
    if (sortMode !== 'distance' || coordinates || locationRequestedRef.current || typeof window === 'undefined') return
    if (!('geolocation' in navigator)) {
      if (!locationNoticeShownRef.current) {
        Toast.show({ content: copy.search.distanceUnavailable, icon: 'fail' })
        locationNoticeShownRef.current = true
      }
      return
    }

    locationRequestedRef.current = true

    navigator.geolocation.getCurrentPosition(
      (position) => {
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
  }, [coordinates, copy.search.distanceUnavailable, sortMode])

  const stationOptions = useMemo(
    () =>
      routes.flatMap((route) =>
        route.stations.filter((station) => !station.is_terminal).map((station) => ({ ...station }))
      ),
    [routes]
  )

  const uniqueStations = useMemo(
    () =>
      Array.from(
        stationOptions.reduce<Map<string, Station>>((accumulator, station) => {
          if (!accumulator.has(station.name)) accumulator.set(station.name, station)
          return accumulator
        }, new Map())
      )
        .map(([, station]) => station)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [stationOptions]
  )

  const filteredStations = useMemo(
    () =>
      uniqueStations.filter((station) =>
        station.name.toLowerCase().includes(keyword.trim().toLowerCase())
      ),
    [keyword, uniqueStations]
  )

  const distanceSortedStations = useMemo(() => {
    if (!coordinates) return filteredStations

    return [...filteredStations].sort((left, right) => {
      const leftDistance = getDistanceInKm(coordinates, { lat: left.lat, lng: left.lng })
      const rightDistance = getDistanceInKm(coordinates, { lat: right.lat, lng: right.lng })
      if (leftDistance === rightDistance) return left.name.localeCompare(right.name)
      return leftDistance - rightDistance
    })
  }, [coordinates, filteredStations])

  const groupedStations = useMemo(
    () =>
      filteredStations.reduce<StationGroups>((accumulator, station) => {
        const index = getStationIndex(station.name)
        if (!accumulator[index]) accumulator[index] = []
        accumulator[index].push(station)
        return accumulator
      }, {}),
    [filteredStations]
  )

  const stationIndexes = useMemo(
    () =>
      Object.keys(groupedStations).sort((left, right) => {
        if (left === '#') return 1
        if (right === '#') return -1
        return left.localeCompare(right)
      }),
    [groupedStations]
  )

  const visibleStations = sortMode === 'distance' ? distanceSortedStations : filteredStations

  return (
    <div style={{ minHeight: '100dvh', background: '#fff' }}>
      <NavBar onBack={() => router.back()}>{copy.search.title}</NavBar>

      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          padding: '8px 12px 10px',
          background: '#f7f7f7',
          borderBottom: '1px solid #e5e5ea',
        }}
      >
        <SearchBar
          placeholder={copy.search.searchPlaceholder}
          value={keyword}
          onChange={setKeyword}
          style={{
            flex: 1,
            '--background': '#ffffff',
            '--border-radius': '10px',
          }}
        />
        <Button
          aria-label={copy.search.map}
          onClick={() => {
            void router.push('/search-map')
          }}
          fill='none'
          size='small'
          style={{
            minWidth: 36,
            height: 36,
            padding: 0,
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            color: '#1677ff',
          }}
        >
          <TravelOutline fontSize={17} />
        </Button>
      </div>

      <div
        style={{
          padding: '10px 12px',
          background: '#fff',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <Segmented
          block
          value={sortMode}
          onChange={(value) => {
            setSortMode(value as SortMode)
          }}
          options={[
            { label: copy.search.alphabetical, value: 'alphabetical' },
            { label: copy.search.distance, value: 'distance' },
          ]}
        />
      </div>

      <div>
        {routesLoading ? (
          <div style={{ padding: '16px 12px', background: '#fff' }}>
            <Skeleton.Paragraph lineCount={8} animated />
          </div>
        ) : sortMode === 'distance' ? (
          <List>
            {visibleStations.map((station) => (
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
        ) : (
          <IndexBar
            style={{
              height: 'calc(100dvh - 196px)',
              '--sticky-offset-top': '0px',
            }}
          >
            {stationIndexes.map((index) => (
              <IndexBar.Panel key={index} index={index} title={index} brief={index}>
                <List>
                  {groupedStations[index].map((station) => (
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
    </div>
  )
}
