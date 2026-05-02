import type {
  Nullable,
  PlaceSummary,
  RouteStopWithPlace,
  RouteWithStops,
  StopCandidate,
} from '@app-types/core';

export interface Coordinates {
  lat: number;
  lng: number;
}

type RouteSummary = {
  name?: string | null;
  display_name?: string | null;
  line: string;
  service: string;
};

type PlaceGroups = Record<string, PlaceSummary[]>;

function getPlaceName(
  name?: string | null,
  displayName?: string | null,
): string {
  const resolvedName = displayName?.trim() || name?.trim();
  return resolvedName || 'Unnamed stop';
}

export function getRouteLabel(route: RouteSummary): string {
  if (route.display_name?.trim()) {
    return route.display_name.trim();
  }

  if (route.name?.trim()) {
    return route.name.trim();
  }

  return `${route.line} LINE (${route.service})`;
}

export function getVisibleStops(
  route?: Nullable<RouteWithStops>,
): RouteStopWithPlace[] {
  return (route?.stops ?? []).filter(
    (stop) => stop.is_pickup_enabled && !stop.place.is_terminal,
  );
}

export function getUniqueStations(routes: RouteWithStops[]): PlaceSummary[] {
  return Array.from(
    routes
      .flatMap((route) => getVisibleStops(route))
      .reduce<Map<string, PlaceSummary>>((accumulator, stop) => {
        const googlePlaceId = stop.place.google_place_id?.trim();

        if (!googlePlaceId) {
          return accumulator;
        }

        if (!accumulator.has(googlePlaceId)) {
          accumulator.set(googlePlaceId, {
            googlePlaceId,
            name: getPlaceName(stop.place.name, stop.place.display_name),
            lat: stop.place.lat,
            lng: stop.place.lng,
            isTerminal: stop.place.is_terminal,
          });
        }

        return accumulator;
      }, new Map()),
  )
    .map(([, place]) => place)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function filterStationsByKeyword(
  stations: PlaceSummary[],
  keyword: string,
): PlaceSummary[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return stations;
  }

  return stations.filter((station) =>
    station.name.toLowerCase().includes(normalizedKeyword),
  );
}

export function getStationIndex(name: string): string {
  const firstChar = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(firstChar) ? firstChar : '#';
}

export function groupStationsByIndex(stations: PlaceSummary[]): PlaceGroups {
  return stations.reduce<PlaceGroups>((accumulator, station) => {
    const index = getStationIndex(station.name);

    if (!accumulator[index]) {
      accumulator[index] = [];
    }

    accumulator[index].push(station);
    return accumulator;
  }, {});
}

export function sortStationIndexes(groups: PlaceGroups): string[] {
  return Object.keys(groups).sort((left, right) => {
    if (left === '#') return 1;
    if (right === '#') return -1;
    return left.localeCompare(right);
  });
}

export function getDistanceInKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortStationsByDistance(
  stations: PlaceSummary[],
  coordinates: Nullable<Coordinates>,
): PlaceSummary[] {
  if (!coordinates) {
    return stations;
  }

  return [...stations].sort((left, right) => {
    const leftDistance = getDistanceInKm(coordinates, {
      lat: left.lat,
      lng: left.lng,
    });
    const rightDistance = getDistanceInKm(coordinates, {
      lat: right.lat,
      lng: right.lng,
    });

    if (leftDistance === rightDistance) {
      return left.name.localeCompare(right.name);
    }

    return leftDistance - rightDistance;
  });
}

export function getStopCandidates(routes: RouteWithStops[]): StopCandidate[] {
  return routes.flatMap((route) =>
    getVisibleStops(route).flatMap((stop, index) => {
      const googlePlaceId = stop.place.google_place_id?.trim();

      if (!googlePlaceId) {
        return [];
      }

      return [
        {
          googlePlaceId,
          name: getPlaceName(stop.place.name, stop.place.display_name),
          lat: stop.place.lat,
          lng: stop.place.lng,
          isTerminal: stop.place.is_terminal,
          routeStopId: stop.id,
          routeCode: route.route_code,
          routeLabel: getRouteLabel(route),
          stopOrder: index + 1,
          pickupTime: stop.pickup_time,
          notes: stop.notes,
          googleMapsUrl: route.google_maps_url,
          address: stop.place.address,
          formattedAddress: stop.place.formatted_address,
          primaryType: stop.place.primary_type,
          primaryTypeDisplayName: stop.place.primary_type_display_name,
          placeTypes: stop.place.place_types ?? [],
          stopId: stop.place.stop_id ?? null,
        },
      ];
    }),
  );
}

export function getSourceStop(
  allStops: StopCandidate[],
  googlePlaceId: Nullable<string>,
): Nullable<StopCandidate> {
  if (!googlePlaceId) {
    return null;
  }

  return allStops.find((stop) => stop.googlePlaceId === googlePlaceId) ?? null;
}

export function getMatchingStops(
  allStops: StopCandidate[],
  sourceStop: Nullable<StopCandidate>,
): StopCandidate[] {
  if (!sourceStop) {
    return [];
  }

  return allStops.filter(
    (stop) => stop.googlePlaceId === sourceStop.googlePlaceId,
  );
}
