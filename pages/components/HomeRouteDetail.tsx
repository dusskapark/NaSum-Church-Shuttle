import { NavBar } from 'antd-mobile'
import { EnvironmentOutline } from 'antd-mobile-icons'
import RouteStepper from './RouteStepper'
import type { Nullable, RouteWithStations, Station } from '../../lib/types'

interface HomeRouteDetailProps {
  route?: Nullable<RouteWithStations>
  title: string
  backLabel: string
  hint: string
  routeMapLabel: string
  stopCountLabel: string
  myStation: Nullable<Station>
  onBack: () => void
}

export default function HomeRouteDetail({
  route,
  title,
  backLabel,
  hint,
  routeMapLabel,
  stopCountLabel,
  myStation,
  onBack,
}: HomeRouteDetailProps) {
  if (!route) return null

  const visibleStations = route.stations.filter(station => !station.is_terminal)

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
                <EnvironmentOutline style={{ color: 'var(--app-color-link)' }} />
                <span>{routeMapLabel}</span>
              </span>
            ) : null
          }
        >
          {title}
        </NavBar>

        <div style={{ padding: '0 16px' }}>
          {/* <div style={{ fontSize: 13, color: 'var(--app-color-subtle-text)' }}>{hint}</div> */}
          <div style={{ fontSize: 13, color: 'var(--app-color-secondary-text)' }}>
            {visibleStations.length} {stopCountLabel}
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 16px 12px' }}>
        <RouteStepper stations={visibleStations} myStationId={myStation?.id ?? null} />
      </div>
    </div>
  )
}
