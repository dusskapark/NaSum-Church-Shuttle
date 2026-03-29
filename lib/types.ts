import type { Prisma } from '@prisma/client'

export type Nullable<T> = T | null

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

export type Station = Prisma.StationGetPayload<Record<string, never>>
export type Route = Prisma.RouteGetPayload<Record<string, never>>
export type User = Prisma.UserGetPayload<Record<string, never>>
export type UserIdentity = Prisma.UserIdentityGetPayload<Record<string, never>>
export type UserRegistration = Prisma.UserRegistrationGetPayload<Record<string, never>>

export type RouteWithStations = Prisma.RouteGetPayload<{
  include: {
    stations: true
  }
}>

export type RegistrationWithRelations = Prisma.UserRegistrationGetPayload<{
  include: {
    route: {
      include: {
        stations: true
      }
    }
    station: true
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

export type RoutesResponse = RouteWithStations[]

export interface UserRegistrationRequest {
  provider?: string
  provider_uid: string
  display_name?: Nullable<string>
  picture_url?: Nullable<string>
  route_id: string
  station_id: string
}

export interface StopCandidate extends Station {
  routeId: string
  routeLabel: string
  stopOrder: number
  google_maps_url?: Nullable<string>
}
