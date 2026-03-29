export type Locale = "en" | "ko";

export type MiniAppTab = "map" | "search" | "settings";
export type MapMode = "network" | "route" | "stop";

export type RouteFamily =
  | "south"
  | "north-centre"
  | "west"
  | "east"
  | "east-coast"
  | "west-coast";

export type LocalizedText = Partial<Record<Locale, string>>;

export interface Stop {
  id: string;
  name: string;
  localizedName?: LocalizedText;
  stopCode?: string;
  lat: number;
  lng: number;
  aliases: string[];
  area: string;
  approx?: boolean;
}

export interface RouteStop {
  stopId: string;
  order: number;
  scheduledTime: string;
  isTimingPoint: boolean;
  isCampus: boolean;
  note?: string;
  localizedNote?: LocalizedText;
}

export interface RouteVariant {
  id: string;
  family: RouteFamily;
  variant: string;
  label: string;
  localizedLabel?: LocalizedText;
  color: string;
  googleMapsUrl: string;
  startTime: string;
  arrivalTime: string;
  isMorning: boolean;
  isLateService: boolean;
  estimatedRideMinutes: number;
  stopCount: number;
  sourceVersion: string;
  sourceType: "pdf+google-maps";
  stops: RouteStop[];
}

export interface UserPreference {
  preferredRouteId: string;
  preferredStopId: string | null;
  lastViewedTab: MiniAppTab;
  locale: Locale;
}

export interface MapViewState {
  tab: MiniAppTab;
  mode: MapMode;
  selectedRouteId: string;
  selectedStopId: string | null;
}
