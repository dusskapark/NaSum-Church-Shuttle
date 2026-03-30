import { Button, NavBar, Steps } from 'antd-mobile'
import { useRouter } from 'next/router'
import { EnvironmentOutline } from 'antd-mobile-icons'
import { getVisibleStops } from '../lib/routeSelectors'
import type { Nullable, RouteStopWithPlace, RouteWithStops } from '../lib/types'

interface RouteStepperProps {
  stops?: RouteStopWithPlace[]
  myRouteStopId?: Nullable<string>
  selectedRouteStopId?: Nullable<string>
  stationDetailLabel?: string
  selectedLabel?: string
  onStopSelect?: (routeStopId: string) => void
}

function RouteStepper({
  stops = [],
  myRouteStopId = null,
  selectedRouteStopId = null,
  stationDetailLabel = 'Detail',
  selectedLabel = 'Selected',
  onStopSelect,
}: RouteStepperProps) {
  const router = useRouter()
  const myIndex = stops.findIndex(stop => stop.id === myRouteStopId)

  return (
    <Steps
      direction='vertical'
      current={myIndex >= 0 ? myIndex : undefined}
      style={{ '--title-font-size': '14px', '--description-font-size': '12px' }}
    >
      {stops.map((stop, index) => (
        <Steps.Step
          key={stop.id}
          title={
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
              <Button
                fill='none'
                size='small'
                style={{
                  padding: 0,
                  minHeight: 'auto',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  flex: 1,
                  color: stop.id === selectedRouteStopId ? 'var(--adm-color-primary)' : 'var(--app-color-link)',
                  fontWeight: stop.id === selectedRouteStopId ? 700 : 600,
                }}
                onClick={() => {
                  onStopSelect?.(stop.id)
                }}
              >
                {stop.place.display_name ?? stop.place.name}
              </Button>

              <Button
                fill='none'
                size='mini'
                style={{
                  padding: '2px 6px',
                  fontSize: 11,
                  color: 'var(--app-color-subtle-text)',
                  border: '1px solid var(--app-color-border)',
                }}
                onClick={() => {
                  void router.push({
                    pathname: '/stops',
                    query: { placeId: stop.place.google_place_id },
                  })
                }}
              >
                {stationDetailLabel}
              </Button>
            </div>
          }
          description={
            <>
              {stop.pickup_time
                ? `${stop.pickup_time}${stop.notes ? ` · ${stop.notes}` : ''}`
                : stop.notes ?? undefined}
              {stop.id === selectedRouteStopId && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: 'var(--adm-color-primary)',
                    fontWeight: 600,
                  }}
                >
                  {selectedLabel}
                </div>
              )}
            </>
          }
          status={
            stop.id === selectedRouteStopId || stop.id === myRouteStopId
              ? 'process'
              : index < myIndex
                ? 'finish'
                : 'wait'
          }
        />
      ))}
    </Steps>
  )
}

interface HomeRouteDetailProps {
  route?: Nullable<RouteWithStops>
  title: string
  backLabel: string
  routeMapLabel: string
  stopCountLabel: string
  stationDetailLabel: string
  selectedLabel: string
  myStop: Nullable<RouteStopWithPlace>
  selectedRouteStopId?: Nullable<string>
  onBack: () => void
  onStopSelect?: (routeStopId: string) => void
}

export default function HomeRouteDetail({
  route,
  title,
  backLabel,
  routeMapLabel,
  stopCountLabel,
  stationDetailLabel,
  selectedLabel,
  myStop,
  selectedRouteStopId,
  onBack,
  onStopSelect,
}: HomeRouteDetailProps) {
  if (!route) return null

  const visibleStops = getVisibleStops(route)

  return (
    <div style={{ background: 'var(--adm-color-background)' }}>
      <div
        style={{
          paddingBottom: 12,
          borderBottom: '1px solid var(--app-color-border)',
        }}
      >
        <NavBar
          back={backLabel}
          onBack={onBack}
          right={
            route.google_maps_url ? (
              <span
                onClick={event => {
                  event.stopPropagation()
                  window.open(route.google_maps_url ?? '', '_blank', 'noopener,noreferrer')
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
                <EnvironmentOutline />
                <span>{routeMapLabel}</span>
              </span>
            ) : null
          }
        >
          {title}
        </NavBar>

        <div style={{ padding: '0 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--app-color-secondary-text)' }}>
            {visibleStops.length} {stopCountLabel}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 16px 12px' }}>
        <RouteStepper
          stops={visibleStops}
          myRouteStopId={myStop?.id ?? null}
          selectedRouteStopId={selectedRouteStopId}
          stationDetailLabel={stationDetailLabel}
          selectedLabel={selectedLabel}
          onStopSelect={onStopSelect}
        />
      </div>
    </div>
  )
}

export { RouteStepper }
