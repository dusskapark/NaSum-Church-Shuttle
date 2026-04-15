export type AdminScheduleStatus = 'draft' | 'published' | 'archived';

export type AdminRouteSyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface AdminRouteBase {
  id: string;
  route_code: string;
  name: string | null;
  display_name: string | null;
  line: string;
  service: string;
  sync_status: string;
  last_synced_at: string | null;
  active: boolean;
  stop_count: number;
}

export interface AdminRouteListItem extends AdminRouteBase {
  incomplete_stop_count: number;
}

export interface AdminRouteDetail extends AdminRouteBase {
  google_maps_url: string | null;
  sync_error: string | null;
}

export interface AdminLiveStopPlace {
  name: string;
  display_name: string | null;
  is_terminal: boolean;
  google_place_id: string;
}

export interface AdminLiveStop {
  id: string;
  sequence: number;
  pickup_time: string | null;
  is_pickup_enabled: boolean;
  notes: string | null;
  stop_id: string | null;
  place: AdminLiveStopPlace;
}

export interface AdminLiveRoute {
  id: string;
  route_code: string;
  stops: AdminLiveStop[];
}

export interface AdminScheduleSummary {
  id: string;
  name: string;
  status: AdminScheduleStatus;
  published_at: string | null;
  has_incomplete_stops: boolean;
}

export type AdminStopChangeType = 'unchanged' | 'added' | 'updated' | 'removed';

export interface AdminStopSnapshotListItem {
  sequence: number;
  pickup_time: string | null;
  google_place_id: string;
  place_name: string;
  place_display_name: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  is_terminal: boolean;
  stop_id: string | null;
  change_type: string;
}

export interface AdminScheduleDetailRoute {
  route_id: string;
  route_code: string;
  route_name: string | null;
  display_name: string | null;
  line: string;
  service: string;
  google_maps_url: string | null;
  stops_snapshot: AdminStopSnapshotListItem[];
}

export interface AdminScheduleDetail {
  id: string;
  name: string;
  status: string;
  routes: AdminScheduleDetailRoute[];
}

export interface AdminScheduleRouteSummary {
  id: string;
  route_id: string;
  route_code: string;
  route_name: string | null;
  display_name: string | null;
  line: string;
  service: string;
  google_maps_url: string | null;
  stops_snapshot: Array<{
    is_pickup_enabled: boolean;
    pickup_time: string | null;
    change_type: string;
  }>;
  sync_status: AdminRouteSyncStatus;
  sync_error: string | null;
}

export interface AdminSchedule {
  id: string;
  name: string;
  status: AdminScheduleStatus;
  created_at: string;
  published_at: string | null;
  routes: AdminScheduleRouteSummary[];
}

export interface AdminScheduleStopSnapshot {
  route_stop_id: string | null;
  sequence: number;
  pickup_time: string | null;
  is_pickup_enabled: boolean;
  notes: string | null;
  place_id: string | null;
  google_place_id: string;
  place_name: string;
  place_display_name: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  place_notes: string | null;
  is_terminal: boolean;
  stop_id: string | null;
  change_type: AdminStopChangeType;
}

export interface AdminScheduleRouteDetail {
  id: string;
  route_id: string;
  route_code: string;
  route_name: string | null;
  display_name: string | null;
  line: string;
  service: string;
  google_maps_url: string | null;
  stops_snapshot: AdminScheduleStopSnapshot[];
  sync_status: AdminRouteSyncStatus;
  synced_at: string | null;
  sync_error: string | null;
  active?: boolean;
}

export interface AdminScheduleWithRouteDetails {
  id: string;
  name: string;
  status: AdminScheduleStatus;
  created_at: string;
  published_at: string | null;
  routes: AdminScheduleRouteDetail[];
}
