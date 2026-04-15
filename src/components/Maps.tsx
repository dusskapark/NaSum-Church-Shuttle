import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Skeleton, Toast } from 'antd-mobile';
import { useAppSettings } from '../lib/app-settings';
import type {
  Nullable,
  PlaceSummary,
  RoutePathPoint,
  RouteStopWithPlace,
  StopBoardingState,
  StopCandidate,
} from '@app-types/core';

const FOCUSED_ZOOM = 14;
const DEFAULT_CENTER = { lat: 1.3521, lng: 103.8198 };
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? 'DEMO_MAP_ID';

function MapSkeleton() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        padding: 16,
        background: 'var(--adm-color-background)',
      }}
    >
      <Skeleton animated style={{ height: '100%', borderRadius: 8 }} />
    </div>
  );
}

function useResolvedColors() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return { primary: '#1f6feb', secondary: '#8c959f' };
    }
    const style = getComputedStyle(document.documentElement);
    return {
      primary: style.getPropertyValue('--adm-color-primary').trim() || '#1f6feb',
      secondary:
        style.getPropertyValue('--adm-color-text-secondary').trim() ||
        '#8c959f',
    };
  }, []);
}

function MapViewportSync({
  center,
  zoom,
  points,
}: {
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  points?: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google) return;

    // Focused stop selection should take precedence over route-wide fitBounds.
    if (center) {
      map.panTo(center);
      if (zoom) map.setZoom(zoom);
      return;
    }

    if (points && points.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, 48);
    }
  }, [center, map, points, zoom]);

  return null;
}

function Polyline({
  path,
  strokeColor,
  strokeOpacity,
}: {
  path: Array<{ lat: number; lng: number }>;
  strokeColor: string;
  strokeOpacity: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google || path.length < 2) return;
    const polyline = new window.google.maps.Polyline({
      path,
      strokeColor,
      strokeOpacity,
      strokeWeight: 4,
      map,
    });

    return () => polyline.setMap(null);
  }, [map, path, strokeColor, strokeOpacity]);

  return null;
}

function MarkerBadge({
  label,
  filled,
  borderColor,
  color,
}: {
  label: number;
  filled: boolean;
  borderColor: string;
  color: string;
}) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: filled ? borderColor : '#ffffff',
        border: `2px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: filled ? '#ffffff' : color,
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
      }}
    >
      {label}
    </div>
  );
}

function MapFrame({
  children,
  defaultCenter,
  defaultZoom = 12,
  onLoad,
}: {
  children: React.ReactNode;
  defaultCenter: { lat: number; lng: number };
  defaultZoom?: number;
  onLoad?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const { isDark } = useAppSettings();

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {!loaded && <MapSkeleton />}
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          colorScheme={isDark ? 'DARK' : 'LIGHT'}
          gestureHandling="greedy"
          disableDefaultUI
          mapId={GOOGLE_MAP_ID}
          onTilesLoaded={() => {
            setLoaded(true);
            onLoad?.();
          }}
          style={{ width: '100%', height: '100%' }}
        >
          {children}
        </Map>
      </APIProvider>
    </div>
  );
}

interface ShuttleMapProps {
  stops: RouteStopWithPlace[];
  cachedPath: RoutePathPoint[];
  pathCacheStatus: Nullable<string>;
  myStop: Nullable<RouteStopWithPlace>;
  stopStates?: StopBoardingState[];
  currentLocationAriaLabel: string;
  currentLocationUnavailable: string;
}

export function ShuttleMap({
  stops,
  cachedPath,
  myStop,
  stopStates,
}: ShuttleMapProps) {
  const colors = useResolvedColors();

  const points = useMemo(
    () => stops.map((stop) => ({ lat: stop.place.lat, lng: stop.place.lng })),
    [stops],
  );

  const path = useMemo(
    () =>
      cachedPath.length > 0
        ? cachedPath.map((point) => ({ lat: point.lat, lng: point.lng }))
        : points,
    [cachedPath, points],
  );

  const stopStateByStopId = useMemo(() => {
    const value: Record<string, number> = {};
    (stopStates ?? []).forEach((stop) => {
      value[stop.route_stop_id] = stop.total_passengers;
    });
    return value;
  }, [stopStates]);

  if (stops.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--app-color-surface-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--app-color-subtle-text)',
          fontSize: 13,
        }}
      >
        No stops to display
      </div>
    );
  }

  const center = myStop
    ? { lat: myStop.place.lat, lng: myStop.place.lng }
    : points[0] ?? DEFAULT_CENTER;
  const runActive = (stopStates ?? []).length > 0;

  return (
    <MapFrame defaultCenter={center}>
      <MapViewportSync
        center={center}
        points={points}
        zoom={myStop ? FOCUSED_ZOOM : undefined}
      />
      <Polyline
        path={path}
        strokeColor={runActive ? colors.primary : colors.secondary}
        strokeOpacity={runActive ? 0.8 : 0.6}
      />
      {stops.map((stop, index) => {
        const boarded = stopStateByStopId[stop.id];
        const label = String(runActive ? boarded ?? 0 : index + 1);

        return (
          <AdvancedMarker
            key={stop.id}
            position={{ lat: stop.place.lat, lng: stop.place.lng }}
          >
            <MarkerBadge
              borderColor={runActive ? colors.primary : colors.secondary}
              color={runActive ? colors.primary : colors.secondary}
              filled={myStop?.id === stop.id}
              label={Number(label)}
            />
          </AdvancedMarker>
        );
      })}
    </MapFrame>
  );
}

interface StationBrowserMapProps {
  places: PlaceSummary[];
  currentLocationAriaLabel: string;
  currentLocationUnavailable: string;
  onSelect: (googlePlaceId: string) => void;
}

const mapControlButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  background: 'var(--adm-color-background)',
  border: '1px solid var(--adm-color-border)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 20,
  fontWeight: 400,
  color: 'var(--adm-color-text)',
  padding: 0,
  lineHeight: 1,
};

function BrowserMapControls({
  currentLocationAriaLabel,
  currentLocationUnavailable,
}: Pick<
  StationBrowserMapProps,
  'currentLocationAriaLabel' | 'currentLocationUnavailable'
>) {
  const map = useMap();

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      Toast.show({ content: currentLocationUnavailable, icon: 'fail' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        map?.panTo({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        map?.setZoom(FOCUSED_ZOOM);
      },
      () => {
        Toast.show({ content: currentLocationUnavailable, icon: 'fail' });
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 80,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 10,
      }}
    >
      <button
        aria-label="Zoom in"
        onClick={() => map?.setZoom((map.getZoom() ?? 12) + 1)}
        style={mapControlButtonStyle}
      >
        +
      </button>
      <button
        aria-label="Zoom out"
        onClick={() => map?.setZoom((map.getZoom() ?? 12) - 1)}
        style={mapControlButtonStyle}
      >
        −
      </button>
      <button
        aria-label={currentLocationAriaLabel}
        onClick={handleCurrentLocation}
        style={{ ...mapControlButtonStyle, marginTop: 8 }}
      >
        <svg
          fill="none"
          height="18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="18"
        >
          <circle cx="12" cy="12" r="3" />
          <line x1="12" x2="12" y1="2" y2="6" />
          <line x1="12" x2="12" y1="18" y2="22" />
          <line x1="2" x2="6" y1="12" y2="12" />
          <line x1="18" x2="22" y1="12" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export function StationBrowserMap({
  places,
  onSelect,
  currentLocationAriaLabel,
  currentLocationUnavailable,
}: StationBrowserMapProps) {
  const points = useMemo(
    () => places.map((place) => ({ lat: place.lat, lng: place.lng })),
    [places],
  );

  if (places.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--app-color-surface-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--app-color-subtle-text)',
          fontSize: 13,
        }}
      >
        No stops to display
      </div>
    );
  }

  return (
    <MapFrame defaultCenter={points[0] ?? DEFAULT_CENTER}>
      <MapViewportSync points={points} />
      {places.map((place) => (
        <AdvancedMarker
          key={place.googlePlaceId}
          onClick={() => onSelect(place.googlePlaceId)}
          position={{ lat: place.lat, lng: place.lng }}
        >
          <Pin
            background={place.isTerminal ? '#0f766e' : '#1f6feb'}
            borderColor="#ffffff"
            glyphColor="#ffffff"
          />
        </AdvancedMarker>
      ))}
      <BrowserMapControls
        currentLocationAriaLabel={currentLocationAriaLabel}
        currentLocationUnavailable={currentLocationUnavailable}
      />
    </MapFrame>
  );
}

interface StopPreviewMapProps {
  stop: Nullable<StopCandidate>;
  previewLabel: string;
  routeMapLabel: string;
  googleMapsLabel: string;
}

export function StopPreviewMap({ stop }: StopPreviewMapProps) {
  if (!stop) return null;

  return (
    <MapFrame
      defaultCenter={{ lat: stop.lat, lng: stop.lng }}
      defaultZoom={15}
    >
      <MapViewportSync center={{ lat: stop.lat, lng: stop.lng }} zoom={15} />
      <AdvancedMarker position={{ lat: stop.lat, lng: stop.lng }}>
        <Pin
          background="#1f6feb"
          borderColor="#0f172a"
          glyphColor="#ffffff"
        />
      </AdvancedMarker>
    </MapFrame>
  );
}
