import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { IndexBar, List, NavBar, SearchBar, Skeleton, Toast } from 'antd-mobile'
import { getCopy } from '../lib/copy'

function getStationIndex(name) {
  const firstChar = name.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(firstChar) ? firstChar : '#'
}

export default function StationFinder() {
  const router = useRouter()
  const copy = getCopy('en')

  const [routes, setRoutes] = useState([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    fetch('/api/v1/routes')
      .then((r) => r.json())
      .then(setRoutes)
      .catch(() => Toast.show({ content: copy.common.routeLoadError, icon: 'fail' }))
      .finally(() => setRoutesLoading(false))
  }, [copy.common.routeLoadError])

  const stationOptions = routes
    .flatMap((route) =>
      route.stations
        .filter((station) => !station.is_terminal)
        .map((station) => ({
          ...station,
        }))
    )

  const uniqueStations = Array.from(
    stationOptions.reduce((acc, station) => {
      if (!acc.has(station.name)) acc.set(station.name, station)
      return acc
    }, new Map()).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const filteredStations = uniqueStations.filter((station) =>
    station.name.toLowerCase().includes(keyword.trim().toLowerCase())
  )

  const groupedStations = filteredStations.reduce((acc, station) => {
    const index = getStationIndex(station.name)
    if (!acc[index]) acc[index] = []
    acc[index].push(station)
    return acc
  }, {})

  const stationIndexes = Object.keys(groupedStations).sort((a, b) => {
    if (a === '#') return 1
    if (b === '#') return -1
    return a.localeCompare(b)
  })

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#fff',
      }}
    >
      <NavBar onBack={() => router.back()}>{copy.search.title}</NavBar>

      <div
        style={{
          padding: '8px 12px 10px',
          background: '#f7f7f7',
          borderBottom: '1px solid #e5e5ea',
        }}
      >
        <SearchBar
          placeholder='Search stops'
          value={keyword}
          onChange={setKeyword}
          style={{
            '--background': '#ffffff',
            '--border-radius': '10px',
          }}
        />
      </div>

      <div>
        {routesLoading ? (
          <div style={{ padding: '16px 12px', background: '#fff' }}>
            <Skeleton.Paragraph lineCount={8} animated />
          </div>
        ) : (
          <IndexBar
            style={{
              height: 'calc(100dvh - 142px)',
              '--sticky-offset-top': '0px',
            }}
          >
            {stationIndexes.map((index) => (
              <IndexBar.Panel key={index} index={index} title={index} brief={index}>
                <List>
                  {groupedStations[index].map((station) => {
                    return (
                      <List.Item
                        key={station.id}
                        onClick={() => {
                          router.push({
                            pathname: '/stops',
                            query: { stationId: station.id },
                          })
                        }}
                      >
                        {station.name}
                      </List.Item>
                    )
                  })}
                </List>
              </IndexBar.Panel>
            ))}
          </IndexBar>
        )}
      </div>
    </div>
  )
}
