"use client";

import dynamic from "next/dynamic";
import { Button, Card, Drawer, Input, Tag } from "antd";
import { useEffect, useMemo, useState } from "react";

import { DraggableBottomSheet } from "@/components/draggable-bottom-sheet";
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

type AppScreen = "home" | "status";

export function MiniApp({ appVersion }: { appVersion: string }) {
  const [locale, setLocale] = useState<Locale>(defaultUserPreference.locale);
  const [viewState, setViewState] = useState<MapViewState>(defaultViewState);
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const [isLiffClient, setIsLiffClient] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [screen, setScreen] = useState<AppScreen>("home");
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
      setScreen(validStopId ? "status" : "home");
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
  const selectedStop = viewState.selectedStopId ? stopsById[viewState.selectedStopId] : null;

  const nearbyStopResults = useMemo(() => {
    const normalizedQuery = finderQuery.trim().toLowerCase();

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

        if (normalizedQuery && !haystack.some((value) => value.includes(normalizedQuery))) {
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
      .slice(0, normalizedQuery ? 10 : 6);
  }, [finderQuery, locale, selectedRoute.id]);

  function selectStop(routeId: string, stopId: string) {
    setViewState((current) => ({
      ...current,
      tab: "map",
      mode: "stop",
      selectedRouteId: routeId,
      selectedStopId: stopId,
    }));
    setFinderOpen(false);
    setFinderQuery("");
    setScreen("status");
    setMapFocusNonce((current) => current + 1);
  }

  function resetPickup() {
    setViewState((current) => ({
      ...current,
      mode: "route",
      selectedStopId: null,
    }));
    setScreen("home");
  }

  function recenterMap() {
    setMapFocusNonce((current) => current + 1);
  }

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#f4f5f7] text-slate-950">
      {screen === "home" ? (
        <section className="absolute inset-0 flex flex-col px-5 pb-8 pt-6 animate-[fadeSlideUp_320ms_ease-out]">
          <div className="mx-auto w-full max-w-md rounded-[34px] bg-[#0f172a] px-6 py-7 text-white shadow-[0_25px_60px_rgba(15,23,42,0.38)]">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Shuttle</p>
            <h1 className="mt-3 text-[1.95rem] font-semibold leading-tight">{dictionary.brandTitle}</h1>
            <p className="mt-3 text-sm text-slate-300">{dictionary.brandSubtitle}</p>
          </div>

          <div className="mx-auto mt-5 w-full max-w-md rounded-[30px] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Nearby pickup</p>
            <p className="mt-2 text-sm text-slate-600">
              {selectedStop
                ? `${selectedStop.name} · ${selectedStop.area}`
                : "저장된 정류장이 없습니다. 먼저 주변 정류장을 검색해 선택해 주세요."}
            </p>
            <Button
              type="primary"
              size="large"
              className="mt-5 h-14 w-full rounded-2xl bg-black text-base font-semibold hover:!bg-slate-800"
              onClick={() => {
                if (selectedStop) {
                  setScreen("status");
                  return;
                }
                setFinderOpen(true);
              }}
            >
              {selectedStop ? "셔틀 상태 페이지로 이동" : "셔틀버스 정류장 찾기"}
            </Button>
          </div>

          <div className="mx-auto mt-auto w-full max-w-md rounded-[26px] bg-white/92 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.1)] backdrop-blur">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>선택된 노선</span>
              <Tag color="blue">{selectedRoute.label}</Tag>
            </div>
            <Button className="mt-4 w-full" onClick={() => setFinderOpen(true)}>
              정류장 다시 선택
            </Button>
          </div>
        </section>
      ) : (
        <section className="absolute inset-0 animate-[fadeSlideUp_320ms_ease-out]">
          <div className="absolute inset-x-0 top-0 z-[510] flex justify-center px-4 pt-4">
            <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-white/70 bg-white/92 px-3 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur">
              <Button type="text" shape="circle" onClick={() => setScreen("home")} aria-label="Home">
                ←
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{selectedStop?.name ?? "정류장 미선택"}</p>
                <p className="truncate text-xs text-slate-500">{selectedRoute.label} · 실시간 운행 상태</p>
              </div>
              <Button type="text" shape="circle" onClick={recenterMap} aria-label={dictionary.map.recenter}>
                ⦿
              </Button>
              <Button type="text" shape="circle" onClick={() => setSettingsOpen(true)} aria-label={dictionary.map.settings}>
                ⚙
              </Button>
            </div>
          </div>

          <div className="absolute inset-0">
            <MiniMap
              mode={viewState.mode}
              routes={routes}
              selectedRouteId={selectedRoute.id}
              selectedStopId={viewState.selectedStopId}
              focusNonce={mapFocusNonce}
              onSelectRoute={(routeId) =>
                setViewState((current) => ({ ...current, mode: "route", selectedRouteId: routeId, selectedStopId: null }))
              }
              onSelectStop={selectStop}
            />
          </div>

          <DraggableBottomSheet initialSnap={1} snapPoints={[0.24, 0.42, 0.74]}>
            <div className="space-y-4 pb-2">
              <div className="rounded-[24px] bg-[#111827] px-5 py-5 text-white">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Current pickup</p>
                <h2 className="mt-2 text-xl font-semibold">{selectedStop?.name ?? "정류장을 선택해 주세요"}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedStop?.area ?? "근처 정류장을 탐색 후 저장하면 이 화면에 경로 상태가 표시됩니다."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Tag color="blue">{selectedRoute.label}</Tag>
                  <Tag color={selectedRoute.isLateService ? "geekblue" : "gold"}>
                    {selectedRoute.isLateService ? dictionary.map.lateService : dictionary.map.morning}
                  </Tag>
                </div>
              </div>

              <Card className="rounded-[24px] border-0 bg-slate-50">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Route status</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>• 운행 시간: {selectedRoute.startTime} - {selectedRoute.arrivalTime}</li>
                  <li>• 예상 소요: {selectedRoute.estimatedRideMinutes}분</li>
                  <li>• 총 정류장: {selectedRoute.stopCount}개</li>
                </ul>
                <Button className="mt-4 w-full" onClick={() => setFinderOpen(true)}>
                  정류장 변경
                </Button>
                <Button className="mt-2 w-full" onClick={resetPickup}>
                  저장 해제 후 처음으로
                </Button>
              </Card>
            </div>
          </DraggableBottomSheet>
        </section>
      )}

      {finderOpen ? (
        <div className="absolute inset-0 z-[700] bg-black/35 backdrop-blur-[1px]">
          <DraggableBottomSheet initialSnap={2} snapPoints={[0.32, 0.56, 0.88]}>
            <div>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Shuttle stop finder</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">근처 정류장 검색</h2>
                </div>
                <Button type="text" onClick={() => setFinderOpen(false)}>
                  닫기
                </Button>
              </div>

              <Input
                value={finderQuery}
                onChange={(event) => setFinderQuery(event.target.value)}
                placeholder="정류장, 지역, 노선 검색"
                size="large"
              />

              <div className="mt-4 space-y-2">
                {nearbyStopResults.map((result) => (
                  <button
                    key={`${result.routeId}-${result.stop.id}`}
                    type="button"
                    onClick={() => selectStop(result.routeId, result.stop.id)}
                    className="flex w-full items-start justify-between rounded-[20px] border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{result.stop.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{result.stop.area} · {result.routeLabel}</p>
                    </div>
                    <span className="text-slate-400">저장</span>
                  </button>
                ))}
              </div>
            </div>
          </DraggableBottomSheet>
        </div>
      ) : null}

      <Drawer
        title={dictionary.map.settings}
        placement="bottom"
        size="auto"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <div className="space-y-4 pb-6">
          <div className="rounded-[24px] bg-slate-950 px-5 py-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">{mockLineProfile.displayName}</p>
            <p className="mt-2 text-sm text-slate-300">{mockLineProfile.handle}</p>
            <p className="mt-3 text-sm text-slate-200">{mockLineProfile.statusMessage}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{dictionary.settings.version}</p>
              <p className="mt-2 font-semibold text-slate-950">{appVersion}</p>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{dictionary.settings.language}</p>
              <div className="mt-2 flex gap-2">
                <Button size="small" type={locale === "en" ? "primary" : "default"} onClick={() => setLocale("en")}>EN</Button>
                <Button size="small" type={locale === "ko" ? "primary" : "default"} onClick={() => setLocale("ko")}>KO</Button>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-slate-50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{dictionary.settings.preferredRoute}</p>
            <p className="mt-2 font-semibold text-slate-950">{selectedRoute.label}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{dictionary.settings.preferredStop}</p>
            <p className="mt-2 font-semibold text-slate-950">{selectedStop?.name ?? dictionary.common.noStopSelected}</p>
          </div>

          <p className="text-xs text-slate-500">{isLiffClient ? "Running inside LIFF" : "Running in browser mode"}</p>
        </div>
      </Drawer>
    </main>
  );
}
