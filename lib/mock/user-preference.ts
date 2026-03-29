import type { UserPreference } from "@/types/shuttle";

export const userPreferenceStorageKey = "nasum-church-shuttle:user-preference";

export const defaultUserPreference: UserPreference = {
  preferredRouteId: "south-a",
  preferredStopId: "opp-newton-life-ch",
  lastViewedTab: "map",
  locale: "en",
};

export const mockLineProfile = {
  displayName: "Grace Park",
  handle: "@nasum.shuttle",
  membership: "Sunday rider",
  statusMessage: "Prefers South Line pickup and calm route summaries.",
};

export function readStoredUserPreference(): UserPreference {
  if (typeof window === "undefined") {
    return defaultUserPreference;
  }

  try {
    const raw = window.localStorage.getItem(userPreferenceStorageKey);
    if (!raw) {
      return defaultUserPreference;
    }

    const parsed = JSON.parse(raw) as Partial<UserPreference>;
    return {
      preferredRouteId:
        typeof parsed.preferredRouteId === "string"
          ? parsed.preferredRouteId
          : defaultUserPreference.preferredRouteId,
      preferredStopId:
        typeof parsed.preferredStopId === "string" || parsed.preferredStopId === null
          ? parsed.preferredStopId
          : defaultUserPreference.preferredStopId,
      lastViewedTab:
        parsed.lastViewedTab === "map" ||
        parsed.lastViewedTab === "search" ||
        parsed.lastViewedTab === "settings"
          ? parsed.lastViewedTab
          : defaultUserPreference.lastViewedTab,
      locale:
        parsed.locale === "en" || parsed.locale === "ko"
          ? parsed.locale
          : defaultUserPreference.locale,
    };
  } catch {
    return defaultUserPreference;
  }
}

export function writeStoredUserPreference(preference: UserPreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(userPreferenceStorageKey, JSON.stringify(preference));
}
