import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Footer, FloatingPanel, List, NavBar, Skeleton, Button } from 'antd-mobile'
import { CompassOutline, RightOutline } from 'antd-mobile-icons'
import Layout from '../components/Layout'
import HomeRouteDetail from '../components/RouteDetails'
import { useRegistration } from '../hooks/useRegistration'
import { useRoutes } from '../hooks/useRoutes'
import { useLiff } from '../hooks/useLiff'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import { getRouteLabel, getVisibleStops } from '../lib/routeSelectors'
import type { Nullable, RouteStopWithPlace } from '../lib/types'

const ShuttleMap = dynamic(() => import('../components/Maps').then(mod => ({ default: mod.ShuttleMap })), {
  ssr: false,
})

function getAnchors(): number[] {
  if (typeof window === 'undefined') return [420, 620, 820]

  return [
    Math.round(window.innerHeight * 0.5),
    Math.round(window.innerHeight * 0.72),
    Math.round(window.innerHeight * 0.92),
  ]
}

export default function ShuttleHome() {
  const router = useRouter()
  const { user, loading: liffLoading } = useLiff()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const { routes, loading: routesLoading } = useRoutes(copy.common.routeLoadError)
  const { registration, loading: regLoading } = useRegistration(
    user?.userId ?? null,
    copy.common.serverError
  )

  const selectedRouteCode = typeof router.query.route === 'string' ? router.query.route : null
  const selectedRouteStopId = typeof router.query.stop === 'string' ? router.query.stop : null
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

  const panelRouteCode = !routesLoading && router.isReady && selectedRouteCode ? selectedRouteCode : null
  const isLoading = liffLoading || regLoading || routesLoading
  const actualSelectedRouteCode =
    selectedRouteCode ?? registration?.route?.route_code ?? routes[0]?.route_code ?? null

  const selectedRoute = useMemo(
    () => routes.find(route => route.route_code === actualSelectedRouteCode) ?? null,
    [routes, actualSelectedRouteCode]
  )

  const panelRoute = useMemo(
    () => routes.find(route => route.route_code === panelRouteCode) ?? null,
    [panelRouteCode, routes]
  )

  const selectedStops = selectedRoute?.stops ?? []

  const myStop = useMemo<Nullable<RouteStopWithPlace>>(() => {
    if (selectedRouteStopId && selectedRoute) {
      const urlStop = selectedRoute.stops.find(stop => stop.id === selectedRouteStopId)
      if (urlStop) return urlStop
    }

    if (registration?.route_stop && selectedRoute && registration.route.route_code === selectedRoute.route_code) {
      return registration.route_stop
    }

    return null
  }, [selectedRouteStopId, selectedRoute, registration])

  const handleStopSelect = (routeCode: string, routeStopId: string) => {
    const newUrl = `/?route=${routeCode}&stop=${routeStopId}`
    void router.push(newUrl, undefined, { shallow: false })
  }

  const handleStopDetails = (googlePlaceId: string) => {
    window.open(`/stops?placeId=${encodeURIComponent(googlePlaceId)}`, '_blank')
  }

  return (
    <>
      <Head>
        <title>{copy.home.panelTitle}</title>
      </Head>
      <Layout>
        <div
          style={{
            position: 'relative',
            width: '100vw',
            height: 'var(--app-content-height)',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            <ShuttleMap
              stops={selectedStops}
              cachedPath={selectedRoute?.cachedPath ?? []}
              pathCacheStatus={selectedRoute?.pathCacheStatus ?? null}
              myStop={myStop}
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
                    stationDetailLabel='Detail'
                    selectedLabel={copy.home.selectedBadge}
                    myStop={
                      registration?.route.route_code === panelRoute.route_code ? registration.route_stop : null
                    }
                    selectedRouteStopId={selectedRouteStopId}
                    onBack={() => {
                      void router.push('/', undefined, { shallow: false })
                    }}
                    onStopSelect={routeStopId => {
                      handleStopSelect(panelRoute.route_code, routeStopId)
                    }}
                  />

                  <div style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px) + 24px)' }} />
                </>
              ) : (
                <>
                  <div
                    style={{
                      paddingBottom: '12px',
                      borderBottom: '1px solid var(--app-color-border)',
                    }}
                  >
                    <NavBar backArrow={false}>
                      {copy.home.panelTitle}
                    </NavBar>
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
                        description={`${registration.route_stop.place.display_name ?? registration.route_stop.place.name}${
                          registration.route_stop.pickup_time
                            ? ` · ${copy.common.rideAt} ${registration.route_stop.pickup_time}`
                            : ''
                        }`}
                        extra={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {selectedRouteCode === registration.route.route_code &&
                              selectedRouteStopId === registration.route_stop.id && (
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--adm-color-primary)',
                                    fontWeight: 600,
                                  }}
                                >
                                  {copy.home.selectedBadge}
                                </span>
                              )}
                            <Button
                              size='small'
                              fill='none'
                              onClick={event => {
                                event.stopPropagation()
                                handleStopDetails(registration.route_stop.place.google_place_id)
                              }}
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                color: 'var(--app-color-link)',
                              }}
                            >
                              <RightOutline fontSize={12} />
                            </Button>
                          </div>
                        }
                        onClick={() => {
                          handleStopSelect(registration.route.route_code, registration.route_stop.id)
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
                          const stopCount = getVisibleStops(route).length

                          return (
                            <List.Item
                              key={route.route_code}
                              clickable
                              prefix={<CompassOutline />}
                              extra={`${stopCount} ${copy.home.stopCount}`}
                              onClick={() => {
                                const newUrl = `/?route=${route.route_code}`
                                void router.push(newUrl, undefined, { shallow: false })
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
                    <Footer label={copy.home.footerLabel} content={copy.home.footerContent} />
                  </div>

                  <div style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px) + 24px)' }} />
                </>
              )}
            </div>
          </FloatingPanel>
        </div>
      </Layout>
    </>
  )
}
