import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Footer, FloatingPanel, List, NavBar, Skeleton } from 'antd-mobile'
import { CompassOutline } from 'antd-mobile-icons'
import TabPageLayout from '../components/layout/TabPageLayout'
import { APP_TAB_BAR_SAFE_OFFSET } from '../components/navigation/AppTabBar'
import { useRegistration } from '../hooks/useRegistration'
import { useRoutes } from '../hooks/useRoutes'
import { useLiff } from '../hooks/useLiff'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import { getRouteLabel } from '../lib/routeSelectors'
import type { Nullable, Station } from '../lib/types'

const ShuttleMap = dynamic(() => import('../components/maps/ShuttleMap'), {
  ssr: false,
})
const HomeRouteDetail = dynamic(() => import('../components/routes/HomeRouteDetail'))

function getAnchors(): number[] {
  if (typeof window === 'undefined') return [420, 620, 820]

  return [
    Math.round(window.innerHeight * 0.5),
    Math.round(window.innerHeight * 0.72),
    Math.round(window.innerHeight * 0.92),
  ]
}

export default function ShuttleHome() {
  const { user, loading: liffLoading } = useLiff()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const { routes, loading: routesLoading } = useRoutes(copy.common.routeLoadError)
  const { registration, loading: regLoading } = useRegistration(
    user?.userId ?? null,
    copy.common.serverError
  )

  const [selectedRouteIdState, setSelectedRouteIdState] = useState<Nullable<string>>(null)
  const [panelRouteId, setPanelRouteId] = useState<Nullable<string>>(null)
  const [anchors, setAnchors] = useState<number[]>([420, 620, 820])

  useEffect(() => {
    const syncAnchors = () => {
      setAnchors(getAnchors())
    }

    const frameId = window.requestAnimationFrame(syncAnchors)
    window.addEventListener('resize', syncAnchors)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', syncAnchors)
    }
  }, [])

  const isLoading = liffLoading || regLoading || routesLoading
  const selectedRouteId =
    selectedRouteIdState ?? registration?.route?.id ?? routes[0]?.id ?? null
  const selectedRoute = useMemo(
    () => routes.find(route => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId]
  )
  const panelRoute = useMemo(
    () => routes.find(route => route.id === panelRouteId) ?? null,
    [panelRouteId, routes]
  )
  const selectedStations: Station[] = selectedRoute?.stations ?? []
  const myStation = useMemo<Nullable<Station>>(() => {
    if (
      !registration?.station ||
      !selectedRoute ||
      registration.route.id !== selectedRoute.id
    ) {
      return null
    }

    return registration.station
  }, [registration, selectedRoute])

  return (
    <TabPageLayout
      withSafeAreaPadding={false}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <ShuttleMap
          stations={selectedStations}
          myStation={myStation}
          zoomInAriaLabel={copy.home.zoomInAriaLabel}
          zoomOutAriaLabel={copy.home.zoomOutAriaLabel}
          currentLocationAriaLabel={copy.home.currentLocationAriaLabel}
          currentLocationUnavailable={copy.home.currentLocationUnavailable}
        />
      </div>

      <FloatingPanel anchors={anchors} style={{ '--z-index': '20' }}>
        <div
          style={{
            padding: 0,
            background: 'var(--adm-color-background)',
          }}
        >
          {isLoading ? (
            <>
              <Skeleton.Title animated />
              <Skeleton.Paragraph lineCount={7} animated />
            </>
          ) : panelRoute ? (
            <>
              <HomeRouteDetail
                route={panelRoute}
                title={getRouteLabel(panelRoute)}
                backLabel={copy.home.routeDetailBack}
                routeMapLabel={copy.search.map}
                stopCountLabel={copy.home.stopCount}
                myStation={
                  registration?.route.id === panelRoute.id ? registration.station : null
                }
                onBack={() => {
                  setPanelRouteId(null)
                }}
              />

              <div
                style={{
                  height: `calc(${APP_TAB_BAR_SAFE_OFFSET} + 24px)`,
                }}
              />
            </>
          ) : (
            <>
              <div
                style={{
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--app-color-border)',
                }}
              >
                <NavBar backArrow={false}>{copy.home.panelTitle}</NavBar>
              </div>

              {registration ? (
                <List
                  header={copy.home.myRouteHeader}
                  style={{
                    '--border-top': 'none',
                    '--border-bottom': 'none',
                    marginBottom: 12,
                  }}
                >
                  <List.Item
                    prefix={<CompassOutline />}
                    description={`${registration.station.name}${registration.station.pickup_time ? ` · ${copy.common.rideAt} ${registration.station.pickup_time}` : ''}`}
                    extra={copy.home.selectedBadge}
                    onClick={() => {
                      setSelectedRouteIdState(registration.route.id)
                      setPanelRouteId(registration.route.id)
                    }}
                  >
                    {getRouteLabel(registration.route)}
                  </List.Item>
                </List>
              ) : null}

              {routes.length === 0 ? (
                <div style={{ paddingTop: 8 }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: 'var(--app-color-subtle-text)',
                    }}
                  >
                    {copy.home.noRoutes}
                  </div>
                </div>
              ) : (
                <div style={{ paddingTop: 8 }}>
                  <List
                    header={copy.home.routesHeader}
                    style={{
                      '--border-top': 'none',
                      '--border-bottom': 'none',
                      marginBottom: 12,
                    }}
                  >
                    {routes.map(route => {
                      const stopCount = route.stations.filter(
                        station => !station.is_terminal
                      ).length

                      return (
                        <List.Item
                          key={route.id}
                          clickable
                          prefix={<CompassOutline />}
                          extra={`${stopCount} ${copy.home.stopCount}`}
                          onClick={() => {
                            setSelectedRouteIdState(route.id)
                            setPanelRouteId(route.id)
                          }}
                        >
                          {getRouteLabel(route)}
                        </List.Item>
                      )
                    })}
                  </List>
                </div>
              )}

              <div style={{ padding: '8px 12px 0' }}>
                <Footer
                  label={copy.home.footerLabel}
                  content={copy.home.footerContent}
                />
              </div>

              <div
                style={{
                  height: `calc(${APP_TAB_BAR_SAFE_OFFSET} + 24px)`,
                }}
              />
            </>
          )}
        </div>
      </FloatingPanel>
    </TabPageLayout>
  )
}
