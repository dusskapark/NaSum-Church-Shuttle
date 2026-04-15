import { NavBar, Steps } from 'antd-mobile';
import {
  CheckCircleFill,
  ClockCircleFill,
  LocationFill,
  RightOutline,
} from 'antd-mobile-icons';
import { getVisibleStops } from '../lib/routeSelectors';
import type {
  Nullable,
  RouteStopWithPlace,
  RouteWithStops,
  StopBoardingState,
} from '@app-types/core';

function formatBoardedCountLabel(template: string, count: number): string {
  const value = String(count);
  return template
    .replace(/%\{count\}/g, value)
    .replace(/\{count\}/g, value)
    .replace(/%1/g, value);
}

interface RouteStepperProps {
  stops?: RouteStopWithPlace[];
  myRouteStopId?: Nullable<string>;
  selectedRouteStopId?: Nullable<string>;
  stopStates?: StopBoardingState[];
  arrivedLabel?: string;
  waitingLabel?: string;
  detailLabel?: string;
  boardedCountLabel?: string;
  onStopSelect?: (routeStopId: string) => void;
  onStopDetail?: (googlePlaceId: string) => void;
}

function RouteStepper({
  stops = [],
  myRouteStopId = null,
  selectedRouteStopId = null,
  stopStates,
  arrivedLabel = 'Arrived',
  waitingLabel = 'Waiting',
  detailLabel = 'Detail',
  boardedCountLabel,
  onStopSelect,
  onStopDetail,
}: RouteStepperProps) {
  const myIndex = stops.findIndex((stop) => stop.id === myRouteStopId);

  const stateMap = new Map<string, StopBoardingState>(
    (stopStates ?? []).map((s) => [s.route_stop_id, s]),
  );

  const lastArrivedIndex = stopStates
    ? stops.reduce((last, stop, idx) => {
        const state = stateMap.get(stop.id);
        return state?.status === 'arrived' ? idx : last;
      }, -1)
    : -1;

  const currentIndex =
    stopStates != null
      ? lastArrivedIndex >= 0
        ? lastArrivedIndex + 1
        : undefined
      : myIndex >= 0
        ? myIndex
        : undefined;

  const hasRun = stopStates != null;

  return (
    <Steps
      direction="vertical"
      current={currentIndex}
      style={
        {
          '--icon-size': '16px',
          '--indicator-margin-right': '12px',
        } as React.CSSProperties
      }
    >
      {stops.map((stop, index) => {
        const boardingState = stateMap.get(stop.id);
        const isArrived = boardingState?.status === 'arrived';
        const isMyStop = stop.id === myRouteStopId;
        const isSelected = stop.id === selectedRouteStopId;

        let stepStatus: 'finish' | 'process' | 'wait' | undefined;
        let icon: React.ReactNode | undefined;
        if (hasRun) {
          if (index <= lastArrivedIndex) {
            stepStatus = 'finish';
            icon = (
              <CheckCircleFill style={{ color: 'var(--adm-color-success)' }} />
            );
          } else if (lastArrivedIndex >= 0 && index === lastArrivedIndex + 1) {
            stepStatus = 'process';
            icon = (
              <LocationFill style={{ color: 'var(--adm-color-primary)' }} />
            );
          } else {
            stepStatus = 'wait';
            icon = (
              <ClockCircleFill style={{ color: 'var(--adm-color-border)' }} />
            );
          }
        }

        const timeInfo =
          [stop.pickup_time, stop.notes].filter(Boolean).join(' · ') ||
          undefined;

        const countStr = boardedCountLabel
          ? formatBoardedCountLabel(
              boardedCountLabel,
              boardingState?.total_passengers ?? 0,
            )
          : String(boardingState?.total_passengers ?? 0);
        const boardingInfo = boardingState
          ? `${isArrived ? arrivedLabel : waitingLabel} · ${countStr}`
          : undefined;

        const description =
          [timeInfo, boardingInfo].filter(Boolean).join(' · ') || undefined;

        return (
          <Steps.Step
            key={stop.id}
            status={stepStatus}
            icon={icon}
            title={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span
                  onClick={() => onStopSelect?.(stop.id)}
                  style={{
                    cursor: onStopSelect ? 'pointer' : undefined,
                    color: isSelected
                      ? 'var(--adm-color-primary)'
                      : isMyStop
                        ? 'var(--adm-color-info)'
                        : undefined,
                    fontWeight: isSelected || isMyStop ? 700 : undefined,
                    background: isSelected
                      ? 'color-mix(in srgb, var(--adm-color-primary) 12%, transparent)'
                      : undefined,
                    border: isSelected
                      ? '1px solid color-mix(in srgb, var(--adm-color-primary) 45%, transparent)'
                      : undefined,
                    borderRadius: isSelected ? 8 : undefined,
                    padding: isSelected ? '2px 8px' : undefined,
                    flex: 1,
                  }}
                >
                  {stop.place.display_name ?? stop.place.name}
                </span>
                {onStopDetail && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onStopDetail(stop.place.google_place_id);
                    }}
                    style={{
                      color: 'var(--app-color-subtle-text)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {detailLabel}
                    <RightOutline fontSize={10} />
                  </span>
                )}
              </div>
            }
            description={description}
          />
        );
      })}
    </Steps>
  );
}

interface HomeRouteDetailProps {
  route?: Nullable<RouteWithStops>;
  title: string;
  backLabel?: string;
  stopCountLabel: string;
  myStop: Nullable<RouteStopWithPlace>;
  selectedRouteStopId?: Nullable<string>;
  stopStates?: StopBoardingState[];
  arrivedLabel?: string;
  waitingLabel?: string;
  detailLabel?: string;
  isInService?: boolean;
  inServiceLabel?: string;
  boardedCountLabel?: string;
  onBack?: () => void;
  onStopSelect?: (routeStopId: string) => void;
  onStopDetail?: (googlePlaceId: string) => void;
}

export default function HomeRouteDetail({
  route,
  title,
  backLabel,
  stopCountLabel,
  myStop,
  selectedRouteStopId,
  stopStates,
  arrivedLabel,
  waitingLabel,
  detailLabel,
  isInService,
  inServiceLabel,
  boardedCountLabel,
  onBack,
  onStopSelect,
  onStopDetail,
}: HomeRouteDetailProps) {
  if (!route) return null;

  const visibleStops = getVisibleStops(route);

  return (
    <div style={{ background: 'var(--adm-color-background)' }}>
      <div
        style={{
          paddingBottom: 12,
          borderBottom: '1px solid var(--app-color-border)',
        }}
      >
        <NavBar back={backLabel ?? null} onBack={onBack}>
          {title}
        </NavBar>

        <div style={{ padding: '0 16px' }}>
          {isInService && inServiceLabel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  padding: '2px 8px',
                  border: '1px solid var(--adm-color-success)',
                  borderRadius: 12,
                  color: 'var(--adm-color-success)',
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--adm-color-success)',
                    flexShrink: 0,
                  }}
                />
                {inServiceLabel}
              </span>
              {boardedCountLabel && (
                <span style={{ color: 'var(--app-color-secondary-text)' }}>
                  {formatBoardedCountLabel(
                    boardedCountLabel,
                    stopStates?.reduce(
                      (sum, s) => sum + s.total_passengers,
                      0,
                    ) ?? 0,
                  )}
                </span>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--app-color-secondary-text)' }}>
              {visibleStops.length} {stopCountLabel}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '8px 16px',
          paddingBottom:
            'calc(var(--app-tab-bar-height) + env(safe-area-inset-bottom, 0px) + 12px)',
        }}
      >
        <RouteStepper
          stops={visibleStops}
          myRouteStopId={myStop?.id ?? null}
          selectedRouteStopId={selectedRouteStopId}
          stopStates={stopStates}
          arrivedLabel={arrivedLabel}
          waitingLabel={waitingLabel}
          detailLabel={detailLabel}
          boardedCountLabel={boardedCountLabel}
          onStopSelect={onStopSelect}
          onStopDetail={onStopDetail}
        />
      </div>
    </div>
  );
}

export { RouteStepper };
