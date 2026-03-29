"use client";

import dynamic from "next/dynamic";
import { Drawer, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";

import { MapShellHeader } from "@/components/map-shell-header";
import { RouteSheet } from "@/components/route-sheet";
import { getDictionary } from "@/lib/i18n/messages";
import { routes, routesById } from "@/lib/mock/routes";
import { stops, stopsById } from "@/lib/mock/stops";
import {
  defaultUserPreference,
  mockLineProfile,
  readStoredUserPreference,
  writeStoredUserPreference,
} from "@/lib/mock/user-preference";
import type { Locale, MapViewState } from "@/types/shuttle";

const MiniMap = dynamic(() => import("@/components/plain-leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(15,23,42,0.22),rgba(15,23,42,0.06))] text-sm font-medium text-slate-700">
      Loading map canvas...
    </div>
  ),
});

const defaultViewState: MapViewState = {
  tab: defaultUserPreference.lastViewedTab,
  mode: defaultUserPreference.preferredStopId ? "stop" : "route",
  selectedRouteId: defaultUserPreference.preferredRouteId,
  selectedStopId: defaultUserPreference.preferredStopId,
};

function routeHasStop(routeId: string, stopId: string | null) {
  if (!stopId) {
    return false;
  }

  const route = routesById[routeId];
  return route.stops.some((routeStop) => routeStop.stopId === stopId);
}

function detectLiffClient() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  return (
    userAgent.includes("liff") ||
    userAgent.includes(" line/") ||
    window.location.href.includes("liff.state") ||
    typeof (window as Window & { liff?: unknown }).liff !== "undefined"
  );
}

export function MiniApp({ appVersion }: { appVersion: string }) {
  const [locale, setLocale] = useState<Locale>(defaultUserPreference.locale);
  const [viewState, setViewState] = useState<MapViewState>(defaultViewState);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [isLiffClient, setIsLiffClient] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredUserPreference();
    const frame = window.requestAnimationFrame(() => {
      const selectedRoute = routesById[stored.preferredRouteId] ?? routes[0];
      const validStopId =
        stored.preferredStopId && routeHasStop(selectedRoute.id, stored.preferredStopId)
          ? stored.preferredStopId
          : null;

      setLocale(stored.locale);
      setIsLiffClient(detectLiffClient());
      setViewState({
        tab: "map",
        mode: validStopId ? "stop" : "route",
        selectedRouteId: selectedRoute.id,
        selectedStopId: validStopId,
      });
      setReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    writeStoredUserPreference({
      preferredRouteId: viewState.selectedRouteId,
      preferredStopId: viewState.selectedStopId,
      lastViewedTab: viewState.tab,
      locale,
    });
  }, [locale, ready, viewState]);

  const dictionary = getDictionary(locale);
  const selectedRoute = routesById[viewState.selectedRouteId] ?? routes[0];
  const selectedStop = viewState.selectedStopId
    ? stopsById[viewState.selectedStopId]
    : null;

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return stops
      .flatMap((stop) => {
        const servingRoutes = routes.filter((route) =>
          route.stops.some((routeStop) => routeStop.stopId === stop.id),
        );
        const haystack = [
          stop.name.toLowerCase(),
          stop.area.toLowerCase(),
          ...stop.aliases.map((alias) => alias.toLowerCase()),
          ...servingRoutes.map((route) => route.label.toLowerCase()),
        ];

        if (!haystack.some((value) => value.includes(normalizedQuery))) {
          return [];
        }

        const matchedRoute =
          servingRoutes.find((route) => route.id === selectedRoute.id) ?? servingRoutes[0];

        if (!matchedRoute) {
          return [];
        }

        return [
          {
            stop,
            routeId: matchedRoute.id,
            routeLabel: matchedRoute.localizedLabel?.[locale] ?? matchedRoute.label,
          },
        ];
      })
      .slice(0, 6);
  }, [locale, searchQuery, selectedRoute.id]);

  const modeLabel = useMemo(() => {
    if (viewState.mode === "network") {
      return dictionary.map.networkOverview;
    }
    if (viewState.mode === "route") {
      return dictionary.map.routeFocus;
    }
    return dictionary.map.stopFocus;
  }, [dictionary.map.networkOverview, dictionary.map.routeFocus, dictionary.map.stopFocus, viewState.mode]);

  function selectRoute(routeId: string) {
    setViewState((current) => ({
      ...current,
      tab: "map",
      mode: "route",
      selectedRouteId: routeId,
      selectedStopId: null,
    }));
    setMapFocusNonce((current) => current + 1);
  }

  function selectStop(routeId: string, stopId: string) {
    setViewState((current) => ({
      ...current,
      tab: "map",
      mode: "stop",
      selectedRouteId: routeId,
      selectedStopId: stopId,
    }));
    setSearchQuery("");
    setMapFocusNonce((current) => current + 1);
  }

  function goBack() {
    setViewState((current) => {
      if (current.mode === "stop") {
        return { ...current, mode: "route" };
      }

      if (current.mode === "route") {
        return { ...current, mode: "network", selectedStopId: null };
      }

      return current;
    });
    setMapFocusNonce((current) => current + 1);
  }

  function recenterMap() {
    setMapFocusNonce((current) => current + 1);
  }

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#edf4f2_0%,#f6f7f8_52%,#f8fafb_100%)] text-slate-950">
      <div className="absolute inset-x-4 top-[112px] bottom-[250px] overflow-hidden rounded-[38px] border border-white/60 shadow-[0_28px_70px_rgba(15,23,42,0.16)]">
        <MiniMap
          mode={viewState.mode}
          routes={routes}
          selectedRouteId={selectedRoute.id}
          selectedStopId={viewState.selectedStopId}
          focusNonce={mapFocusNonce}
          onSelectRoute={selectRoute}
          onSelectStop={selectStop}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-4 top-[112px] bottom-[250px] rounded-[38px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_40%,rgba(15,23,42,0.08)_100%)]" />

      <MapShellHeader
        dictionary={dictionary}
        selectedRoute={selectedRoute}
        selectedStop={selectedStop}
        modeLabel={modeLabel}
        isLiffClient={isLiffClient}
        searchQuery={searchQuery}
        searchResults={searchResults}
        onBack={goBack}
        onOpenSettings={() => setSettingsOpen(true)}
        onSearchChange={setSearchQuery}
        onSelectSearchResult={selectStop}
      />

      <div className="pointer-events-none absolute right-6 top-[360px] z-[510] flex flex-col gap-3">
        <button
          type="button"
          onClick={recenterMap}
          className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full border border-white/60 bg-white/92 shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
          aria-label={dictionary.map.recenter}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="6.5" />
            <path d="M12 3.5v3" />
            <path d="M12 17.5v3" />
            <path d="M3.5 12h3" />
            <path d="M17.5 12h3" />
          </svg>
        </button>
      </div>

      <RouteSheet
        key={`map-${viewState.mode}-${selectedRoute.id}-${selectedStop?.id ?? "none"}`}
        dictionary={dictionary}
        locale={locale}
        mode={viewState.mode}
        routes={routes}
        selectedRoute={selectedRoute}
        selectedStop={selectedStop}
        onBack={goBack}
        onSelectRoute={selectRoute}
        onSelectStop={selectStop}
      />

      <Drawer
        title={dictionary.map.settings}
        placement="bottom"
        size="auto"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <div className="space-y-4 pb-6">
          <div className="rounded-[24px] bg-slate-950 px-5 py-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              {mockLineProfile.displayName}
            </p>
            <p className="mt-2 text-sm text-slate-300">{mockLineProfile.handle}</p>
            <p className="mt-3 text-sm text-slate-200">{mockLineProfile.statusMessage}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {dictionary.settings.version}
              </p>
              <p className="mt-2 font-semibold text-slate-950">{appVersion}</p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                {dictionary.settings.language}
              </p>
              <div className="mt-2 flex gap-2">
                <Tag color={locale === "en" ? "blue" : "default"}>EN</Tag>
                <Tag color={locale === "ko" ? "blue" : "default"}>KO</Tag>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-slate-50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {dictionary.settings.preferredRoute}
            </p>
            <p className="mt-2 font-semibold text-slate-950">{selectedRoute.label}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {dictionary.settings.preferredStop}
            </p>
            <p className="mt-2 font-semibold text-slate-950">
              {selectedStop?.name ?? dictionary.common.noStopSelected}
            </p>
          </div>
        </div>
      </Drawer>
    </main>
  );
}
