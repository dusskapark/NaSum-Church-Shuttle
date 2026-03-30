import type { Prisma } from '@prisma/client'

export type Nullable<T> = T | null
export interface RoutePathPoint {
  lat: number
  lng: number
}

export interface LiffUser {
  userId: string
  displayName: string
  pictureUrl: Nullable<string>
}

export interface CopyDictionary {
  common: {
    loadingUserName: string
    serverError: string
    routeLoadError: string
    saveError: string
    saveSuccess: string
    openInGoogleMaps: string
    rideAt: string
    stopNumber: string
    line: string
  }
  tabs: {
    home: string
    stops: string
    scan: string
    notifications: string
    settings: string
  }
  home: {
    noRegistration: string
    findStop: string
    later: string
    qrComingSoon: string
    scanQr: string
    changeStop: string
    panelTitle: string
    panelHint: string
    routeDetailBack: string
    routeDetailHint: string
    registeredRouteTitle: string
    registeredRouteHint: string
    selectedStopLabel: string
    browseRoutesTitle: string
    browseRoutesHint: string
    viewStopDetails: string
    viewRouteMap: string
    noRoutes: string
    routesHeader: string
    myRouteHeader: string
    moreHeader: string
    stopCount: string
    requestStop: string
    clearSelection: string
    stationDetail: string
    selected: string
    settings: string
    selectedBadge: string
    footerLabel: string
    footerContent: string
    profileAriaLabel: string
    zoomInAriaLabel: string
    zoomOutAriaLabel: string
    currentLocationAriaLabel: string
    currentLocationUnavailable: string
  }
  scan: {
    title: string
    description: string
    availabilityReady: string
    availabilityLoading: string
    availabilityLineOnly: string
    availabilityUnsupported: string
    availabilityExternal: string
    scanButton: string
    scanAgainButton: string
    scanning: string
    lastResult: string
    emptyResult: string
    scanCancelled: string
    scanFailed: string
    copied: string
    copyResult: string
    openResult: string
    openInApp: string
    resultHint: string
  }
  notifications: {
    title: string
    description: string
  }
  settings: {
    title: string
    profileHeader: string
    routeHeader: string
    preferencesHeader: string
    themeHeader: string
    versionHeader: string
    displayName: string
    userId: string
    currentRoute: string
    currentStop: string
    noRouteSelected: string
    changeRoute: string
    pushNotifications: string
    pushNotificationsHint: string
    language: string
    languageEnglish: string
    languageKorean: string
    darkMode: string
    antdMobileVersion: string
    liffSdkVersion: string
    lineVersion: string
  }
  search: {
    title: string
    list: string
    registerButton: string
    searchPlaceholder: string
    alphabetical: string
    distance: string
    distanceUnavailable: string
    map: string
    mapTitle: string
    mapHint: string
  }
  stopDetail: {
    title: string
    chooseRoute: string
    chooseRouteSectionTitle: string
    chooseRouteSectionHint: string
    noResults: string
    noSelection: string
    registerButton: string
    routeMap: string
    stopMap: string
    stopPreview: string
    notes: string
    route: string
    stopOrder: string
    boardAt: string
  }
}

export type Place = Prisma.PlaceGetPayload<Record<string, never>>
export type Route = Prisma.RouteGetPayload<Record<string, never>>
export type User = Prisma.UserGetPayload<Record<string, never>>
export type UserIdentity = Prisma.UserIdentityGetPayload<Record<string, never>>
export type RouteStopWithPlace = Prisma.RouteStopGetPayload<{
  include: {
    place: true
  }
}>

export type RouteWithStops = Prisma.RouteGetPayload<{
  include: {
    stops: {
      include: {
        place: true
      }
    }
  }
}>

export type RegistrationWithRelations = Prisma.UserRegistrationGetPayload<{
  include: {
    route: {
      include: {
        stops: {
          include: {
            place: true
          }
        }
      }
    }
    route_stop: {
      include: {
        place: true
      }
    }
  }
}>

export interface RegisteredUserPayload {
  id: string
  display_name: Nullable<string>
}

export interface RegisteredUserResponse {
  registered: boolean
  user?: RegisteredUserPayload
  registration?: Nullable<RegistrationWithRelations>
}

export interface UserRegistrationRequest {
  provider?: string
  provider_uid: string
  display_name?: Nullable<string>
  picture_url?: Nullable<string>
  route_code: string
  route_stop_id: string
}

export interface PlaceSummary {
  googlePlaceId: string
  name: string
  lat: number
  lng: number
  isTerminal: boolean
}

export interface StopCandidate extends PlaceSummary {
  routeStopId: string
  routeCode: string
  routeLabel: string
  stopOrder: number
  pickupTime: Nullable<string>
  notes: Nullable<string>
  googleMapsUrl: Nullable<string>
}

export interface RoutePathCacheSnapshot {
  cachedPath: RoutePathPoint[]
  pathCacheStatus: string
  pathCacheUpdatedAt: Nullable<string>
  pathCacheExpiresAt: Nullable<string>
  pathCacheError: Nullable<string>
}

export type ApiRouteWithStops = RouteWithStops & RoutePathCacheSnapshot

export type RoutesResponse = ApiRouteWithStops[]
