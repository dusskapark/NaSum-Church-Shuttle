import type { Locale } from "@/types/shuttle";

export interface Dictionary {
  brandTitle: string;
  brandSubtitle: string;
  tabs: {
    map: string;
    search: string;
    settings: string;
  };
  map: {
    networkOverview: string;
    allRoutes: string;
    routeFocus: string;
    stopFocus: string;
    pickupSearchPlaceholder: string;
    searchResults: string;
    searchEmpty: string;
    selectedPickup: string;
    routeSummary: string;
    routeTimeline: string;
    browseRoutes: string;
    savePickup: string;
    scanQr: string;
    recenter: string;
    settings: string;
    routeDetails: string;
    serviceWindow: string;
    notePlaceholder: string;
    selectedStop: string;
    estimatedRide: string;
    arrival: string;
    routeStops: string;
    openInMaps: string;
    back: string;
    morning: string;
    lateService: string;
    approximatePlacement: string;
    activeRoute: string;
    source: string;
  };
  search: {
    title: string;
    subtitle: string;
    placeholder: string;
    emptyTitle: string;
    emptyDescription: string;
    jump: string;
    servedBy: string;
  };
  settings: {
    title: string;
    subtitle: string;
    language: string;
    profile: string;
    version: string;
    preferredRoute: string;
    preferredStop: string;
    lastTab: string;
    dataVersion: string;
    sourceType: string;
    localeReady: string;
    english: string;
    korean: string;
  };
  common: {
    noStopSelected: string;
    noRouteSelected: string;
    campus: string;
    stopCode: string;
    minutes: string;
    stops: string;
  };
}

export const dictionaries: Record<Locale, Dictionary> = {
  en: {
    brandTitle: "NaSum Church Shuttle",
    brandSubtitle: "Map-first rider mini-app prototype",
    tabs: {
      map: "Map",
      search: "Search",
      settings: "Settings",
    },
    map: {
      networkOverview: "Network overview",
      allRoutes: "All route variants",
      routeFocus: "Route focus",
      stopFocus: "Stop focus",
      pickupSearchPlaceholder: "Search stop or area",
      searchResults: "Search results",
      searchEmpty: "No stops match this search yet.",
      selectedPickup: "Selected pickup",
      routeSummary: "Route summary",
      routeTimeline: "Route timeline",
      browseRoutes: "Browse route",
      savePickup: "Choose this pickup",
      scanQr: "Scan QR to check in",
      recenter: "Recenter map",
      settings: "Settings",
      routeDetails: "Route details",
      serviceWindow: "Service window",
      notePlaceholder: "Add pickup details (e.g. near the gate)",
      selectedStop: "Selected stop",
      estimatedRide: "Estimated ride",
      arrival: "Arrival",
      routeStops: "Stops",
      openInMaps: "Open in Google Maps",
      back: "Back",
      morning: "Morning",
      lateService: "Late service",
      approximatePlacement: "Approximate map placement",
      activeRoute: "Active route",
      source: "Data source",
    },
    search: {
      title: "Search stops",
      subtitle: "Find a stop by route, alias, or neighborhood.",
      placeholder: "Search a stop or area",
      emptyTitle: "No matching stops",
      emptyDescription:
        "Try keywords like Newton, Clementi, Santorini, or Buangkok.",
      jump: "Jump to stop",
      servedBy: "Served by",
    },
    settings: {
      title: "Settings",
      subtitle: "Profile, locale, and saved shuttle preferences.",
      language: "Language",
      profile: "LINE profile",
      version: "App version",
      preferredRoute: "Preferred route",
      preferredStop: "Preferred stop",
      lastTab: "Last tab",
      dataVersion: "Data version",
      sourceType: "Source type",
      localeReady: "Korean locale support is ready.",
      english: "English",
      korean: "Korean",
    },
    common: {
      noStopSelected: "No stop selected",
      noRouteSelected: "No route selected",
      campus: "Campus",
      stopCode: "Stop code",
      minutes: "min",
      stops: "stops",
    },
  },
  ko: {
    brandTitle: "NaSum Church Shuttle",
    brandSubtitle: "지도 중심 라이더 미니앱 프로토타입",
    tabs: {
      map: "지도",
      search: "검색",
      settings: "설정",
    },
    map: {
      networkOverview: "전체 노선 보기",
      allRoutes: "전체 노선",
      routeFocus: "노선 보기",
      stopFocus: "정류장 보기",
      pickupSearchPlaceholder: "정류장 또는 지역 검색",
      searchResults: "검색 결과",
      searchEmpty: "일치하는 정류장이 없습니다.",
      selectedPickup: "선택 정류장",
      routeSummary: "노선 요약",
      routeTimeline: "정류장 단계",
      browseRoutes: "노선 선택",
      savePickup: "이 정류장 선택",
      scanQr: "QR 스캔으로 체크인",
      recenter: "지도 다시 맞추기",
      settings: "설정",
      routeDetails: "노선 정보",
      serviceWindow: "운행 시간",
      notePlaceholder: "픽업 메모 추가 (예: 정문 앞)",
      selectedStop: "선택 정류장",
      estimatedRide: "예상 소요",
      arrival: "도착 예정",
      routeStops: "정류장 수",
      openInMaps: "구글 지도 열기",
      back: "뒤로",
      morning: "오전",
      lateService: "늦은 시간",
      approximatePlacement: "대략적인 지도 위치",
      activeRoute: "선택 노선",
      source: "데이터 출처",
    },
    search: {
      title: "정류장 검색",
      subtitle: "노선, 별칭, 지역명으로 정류장을 찾을 수 있습니다.",
      placeholder: "정류장 또는 지역 검색",
      emptyTitle: "검색 결과가 없습니다",
      emptyDescription:
        "Newton, Clementi, Santorini, Buangkok 같은 키워드로 시도해보세요.",
      jump: "정류장으로 이동",
      servedBy: "운행 노선",
    },
    settings: {
      title: "설정",
      subtitle: "프로필, 언어, 저장된 셔틀 선호 정보를 확인합니다.",
      language: "언어",
      profile: "LINE 프로필",
      version: "앱 버전",
      preferredRoute: "선호 노선",
      preferredStop: "선호 정류장",
      lastTab: "마지막 탭",
      dataVersion: "데이터 버전",
      sourceType: "출처 형식",
      localeReady: "한국어 로케일 지원이 준비되었습니다.",
      english: "영어",
      korean: "한국어",
    },
    common: {
      noStopSelected: "선택된 정류장이 없습니다",
      noRouteSelected: "선택된 노선이 없습니다",
      campus: "캠퍼스",
      stopCode: "정류장 코드",
      minutes: "분",
      stops: "개 정류장",
    },
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}
