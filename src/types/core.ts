export type Nullable<T> = T | null;

export type UserRole = 'rider' | 'driver' | 'admin';

export interface RoutePathPoint {
  lat: number;
  lng: number;
}

export interface LineUser {
  // internal application user id
  userId: string;
  // LINE provider user id used for provider-linked API calls
  providerUid: string;
  displayName: string;
  pictureUrl: Nullable<string>;
  statusMessage: Nullable<string>;
  email: Nullable<string>;
  phone: Nullable<string>;
  role: UserRole;
}

export interface Place {
  id: string;
  google_place_id: string;
  name: string;
  display_name: Nullable<string>;
  address: Nullable<string>;
  formatted_address: Nullable<string>;
  primary_type: Nullable<string>;
  primary_type_display_name: Nullable<string>;
  lat: number;
  lng: number;
  place_types: string[];
  notes: Nullable<string>;
  is_terminal: boolean;
  stop_id: Nullable<string>;
}

export interface Route {
  id: string;
  route_code: string;
  name: Nullable<string>;
  display_name: Nullable<string>;
  line: string;
  service: string;
  revision: number;
  google_maps_url: Nullable<string>;
  path_json: unknown;
  path_cache_status: Nullable<string>;
  path_cache_updated_at: Nullable<string>;
  path_cache_expires_at: Nullable<string>;
  path_cache_error: Nullable<string>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  place_id: string;
  sequence: number;
  pickup_time: Nullable<string>;
  notes: Nullable<string>;
  is_pickup_enabled: boolean;
}

export interface RouteStopWithPlace extends RouteStop {
  place: Place;
}

export interface RouteWithStops extends Route {
  stops: RouteStopWithPlace[];
}

export interface UserRegistration {
  id: string;
  user_id: string;
  route_id: string;
  route_stop_id: string;
  status: string;
}

export interface RegistrationWithRelations extends UserRegistration {
  route: RouteWithStops;
  route_stop: RouteStopWithPlace;
}

export interface RegisteredUserPayload {
  id: string;
  display_name: Nullable<string>;
}

export interface RegisteredUserResponse {
  registered: boolean;
  user?: RegisteredUserPayload;
  registration?: Nullable<RegistrationWithRelations>;
  stop_active?: boolean;
}

export interface MeResponse {
  userId: string;
  providerUid: Nullable<string>;
  displayName: Nullable<string>;
  pictureUrl: Nullable<string>;
  email: Nullable<string>;
  role: UserRole;
  preferredLanguage: 'ko' | 'en';
  pushNotificationsEnabled: boolean;
  createdAt: string;
}

export interface PushTokenRegistrationResponse {
  success: boolean;
  id: string;
  token: string;
  bundle_id: string;
  apns_environment: 'sandbox' | 'production';
  is_active: boolean;
  updated_at: string;
}

export interface UserRegistrationRequest {
  provider?: string;
  provider_uid: string;
  display_name?: Nullable<string>;
  picture_url?: Nullable<string>;
  route_code: string;
  route_stop_id: string;
}

export interface PlaceSummary {
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
  isTerminal: boolean;
}

export interface StopCandidate extends PlaceSummary {
  routeStopId: string;
  routeCode: string;
  routeLabel: string;
  stopOrder: number;
  pickupTime: Nullable<string>;
  notes: Nullable<string>;
  googleMapsUrl: Nullable<string>;
  address: Nullable<string>;
  formattedAddress: Nullable<string>;
  primaryTypeDisplayName: Nullable<string>;
  stopId: Nullable<string>;
}

export interface RoutePathCacheSnapshot {
  cachedPath: RoutePathPoint[];
  pathCacheStatus: string;
  pathCacheUpdatedAt: Nullable<string>;
  pathCacheExpiresAt: Nullable<string>;
  pathCacheError: Nullable<string>;
}

export type ApiRouteWithStops = RouteWithStops & RoutePathCacheSnapshot;

export type RoutesResponse = ApiRouteWithStops[];

export interface RouteSummary {
  id: string;
  route_code: string;
  name: Nullable<string>;
  display_name: Nullable<string>;
  line: string;
  service: string;
  revision: number;
  google_maps_url: Nullable<string>;
  active: boolean;
  visible_stop_count: number;
}

export type RouteSummariesResponse = RouteSummary[];

export type RouteDetailResponse = ApiRouteWithStops;

export type PlaceSummariesResponse = PlaceSummary[];

export interface PlaceRoutesResponse {
  sourceStop: Nullable<StopCandidate>;
  matchingStops: StopCandidate[];
}

export interface ShuttleRun {
  id: string;
  route_id: string;
  service_date: string;
  status: 'scheduled' | 'active' | 'completed';
  started_at: Nullable<string>;
  ended_at: Nullable<string>;
  created_mode: 'manual' | 'auto';
  created_by: Nullable<string>;
  ended_mode: Nullable<'manual' | 'auto'>;
  ended_by: Nullable<string>;
}

/** Run-specific boarding state for a single stop (no static stop info) */
export interface StopBoardingState {
  route_stop_id: string;
  total_passengers: number;
  status: 'waiting' | 'arrived';
}

/** StopBoardingState + rider list (used in run results) */
export interface StopBoardingResult extends StopBoardingState {
  stop_name?: Nullable<string>;
  riders: {
    user_id: string;
    display_name: Nullable<string>;
    picture_url: Nullable<string>;
    additional_passengers: number;
    scanned_at: string;
  }[];
}

export interface ActiveRun {
  run_id: string;
  route_id: string;
  route_code: string;
  started_at: string;
  stop_states: StopBoardingState[];
}

export interface RunResult {
  run: ShuttleRun;
  route: { route_code: string; display_name: Nullable<string> };
  stop_results: StopBoardingResult[];
}

export interface CheckinRequest {
  run_id: string;
  route_stop_id: string;
  provider_uid: string;
  provider?: string;
  display_name?: Nullable<string>;
  picture_url?: Nullable<string>;
  additional_passengers?: number;
}

export interface CheckinResponse {
  success: boolean;
  checkin_id: string;
  stop_state: StopBoardingState;
}

export interface AppNotification {
  id: string;
  run_id: string;
  trigger_stop_id: string;
  stops_away: number;
  title_ko: string;
  body_ko: string;
  title_en: string;
  body_en: string;
  is_read: boolean;
  created_at: string;
  route_code: string | null;
  user_route_stop_id: string | null;
}

/** Pre-check-in info response from GET /api/v1/checkin/run?routeCode=X */
export interface RunInfoResponse {
  run: ShuttleRun;
  route: RouteWithStops;
  stop_states: StopBoardingState[];
  my_checkin: Nullable<{
    checkin_id: string;
    route_stop_id: string;
    stop_state: StopBoardingState;
  }>;
}
