"use client";

import dynamic from "next/dynamic";
import { Button, Card, Drawer, Input, List, Tag } from "antd";
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

type AppScreen = "home" | "search" | "status";

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
  const [screen, setScreen] = useState<AppScreen>("home");
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

  const stopSearchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

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
      .slice(0, normalizedQuery ? 10 : 8);
  }, [locale, searchQuery, selectedRoute.id]);

  function selectStop(routeId: string, stopId: string) {
    setViewState((current) => ({
      ...current,
      tab: "map",
      mode: "stop",
      selectedRouteId: routeId,
      selectedStopId: stopId,
    }));
    setSearchQuery("");
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

  return (
    <main className="relative h-[100dvh] overflow-hidden bg-[#f3f4f6] text-slate-950">
      {(screen === "home" || screen === "status") && (
        <div className="absolute inset-0">
          <div className={screen === "home" ? "absolute inset-x-0 top-0 h-[54dvh]" : "absolute inset-0"}>
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
        </div>
      )}

      {screen === "home" ? (
        <section className="absolute inset-0 z-[520] flex flex-col justify-end animate-[fadeSlideUp_260ms_ease-out]">
          <div className="rounded-t-[34px] border-t border-white/70 bg-white px-4 pb-7 pt-5 shadow-[0_-24px_70px_rgba(15,23,42,0.22)]">
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">Shuttle app</p>
                  <h1 className="mt-1 text-2xl font-semibold text-slate-950">{dictionary.brandTitle}</h1>
                </div>
                <Button type="text" shape="circle" onClick={() => setSettingsOpen(true)} aria-label={dictionary.map.settings}>
                  ⚙
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScreen("search")}
                  className="rounded-2xl bg-slate-100 px-3 py-4 text-left transition hover:bg-slate-200"
                >
                  <p className="text-xl">🚌</p>
                  <p className="mt-2 text-sm font-semibold">셔틀버스</p>
                </button>
                <div className="rounded-2xl bg-slate-100 px-3 py-4 text-left opacity-55">
                  <p className="text-xl">🛴</p>
                  <p className="mt-2 text-sm font-semibold">기타 이동</p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-4 text-left opacity-55">
                  <p className="text-xl">📅</p>
                  <p className="mt-2 text-sm font-semibold">예약</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => (selectedStop ? setScreen("status") : setScreen("search"))}
                className="mt-4 flex h-14 w-full items-center rounded-2xl bg-slate-100 px-4 text-left text-base text-slate-600 transition hover:bg-slate-200"
              >
                {selectedStop ? `${selectedStop.name} 상태 보기` : "어디서 타시나요?"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {screen === "search" ? (
        <section className="absolute inset-0 z-[620] bg-[#edf0f3] animate-[fadeSlideUp_240ms_ease-out]">
          <div className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-6 pt-4">
            <Button type="text" className="mb-2 w-fit" onClick={() => setScreen("home")}>←</Button>

            <div className="rounded-3xl bg-white px-4 py-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex w-6 flex-col items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  <span className="h-7 w-[1px] bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-slate-900" />
                </div>
                <div className="flex-1 space-y-2">
                  <Input value={selectedStop?.name ?? "현재 위치"} readOnly className="rounded-xl" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="근처 셔틀 정류장 검색"
                    className="rounded-xl"
                  />
                </div>
                <Button shape="circle" type="default">+</Button>
              </div>
            </div>

            <Card className="mt-3 rounded-2xl border-0 bg-white shadow-sm">
              <p className="text-sm font-semibold text-slate-900">내 저장 정류장</p>
              <p className="mt-1 text-xs text-slate-500">저장된 정류장을 탭하면 바로 상태 페이지로 이동합니다.</p>
              {selectedStop ? (
                <Button className="mt-3" block onClick={() => setScreen("status")}>{selectedStop.name}</Button>
              ) : null}
            </Card>

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl bg-white p-2 shadow-sm">
              <List
                dataSource={stopSearchResults}
                renderItem={(result) => (
                  <List.Item className="border-0 px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => selectStop(result.routeId, result.stop.id)}
                      className="w-full rounded-2xl bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100"
                    >
                      <p className="text-sm font-semibold text-slate-950">{result.stop.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{result.stop.area}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Tag color="blue">{result.routeLabel}</Tag>
                        <span className="text-xs font-medium text-emerald-600">선택 후 저장</span>
                      </div>
                    </button>
                  </List.Item>
                )}
              />
            </div>
          </div>
        </section>
      ) : null}

      {screen === "status" ? (
        <section className="absolute inset-0 z-[560] animate-[fadeSlideUp_260ms_ease-out]">
          <div className="absolute left-4 top-4 z-[590]">
            <Button shape="circle" onClick={() => setScreen("home")} aria-label="Back to home">
              ←
            </Button>
          </div>

          <DraggableBottomSheet initialSnap={1} snapPoints={[0.26, 0.45, 0.78]}>
            <div className="space-y-3">
              <Card className="rounded-[24px] border-0 bg-black text-white">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-300">Shuttle status</p>
                <h2 className="mt-2 text-xl font-semibold">{selectedStop?.name ?? "정류장 미선택"}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedRoute.label} · {selectedStop?.area ?? "정류장을 먼저 선택하세요."}</p>
                <div className="mt-3 flex gap-2">
                  <Tag color="blue">{selectedRoute.label}</Tag>
                  <Tag color={selectedRoute.isLateService ? "geekblue" : "gold"}>
                    {selectedRoute.isLateService ? dictionary.map.lateService : dictionary.map.morning}
                  </Tag>
                </div>
              </Card>

              <Card className="rounded-[24px] border-0 bg-slate-50">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Route details</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  <li>• 운행 시간: {selectedRoute.startTime} - {selectedRoute.arrivalTime}</li>
                  <li>• 예상 소요: {selectedRoute.estimatedRideMinutes}분</li>
                  <li>• 노선 정류장: {selectedRoute.stopCount}개</li>
                </ul>
                <Button className="mt-3" block onClick={() => setScreen("search")}>정류장 변경</Button>
                <Button className="mt-2" block onClick={resetPickup}>저장 해제</Button>
              </Card>
            </div>
          </DraggableBottomSheet>
        </section>
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
