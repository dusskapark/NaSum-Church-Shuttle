"use client";

import { Button, Card, Divider, Empty, Input, Steps, Tag } from "antd";

import { DraggableBottomSheet } from "@/components/draggable-bottom-sheet";
import type { Dictionary } from "@/lib/i18n/messages";
import { stopsById } from "@/lib/mock/stops";
import type { Locale, MapMode, RouteVariant, Stop } from "@/types/shuttle";

interface RouteSheetProps {
  dictionary: Dictionary;
  locale: Locale;
  mode: MapMode;
  routes: RouteVariant[];
  selectedRoute: RouteVariant;
  selectedStop: Stop | null;
  onBack: () => void;
  onSelectRoute: (routeId: string) => void;
  onSelectStop: (routeId: string, stopId: string) => void;
}

function serviceTag(route: RouteVariant, dictionary: Dictionary) {
  return route.isLateService ? dictionary.map.lateService : dictionary.map.morning;
}

export function RouteSheet({
  dictionary,
  locale,
  mode,
  routes,
  selectedRoute,
  selectedStop,
  onBack,
  onSelectRoute,
  onSelectStop,
}: RouteSheetProps) {
  const currentStepIndex = selectedStop
    ? selectedRoute.stops.findIndex((routeStop) => routeStop.stopId === selectedStop.id)
    : 0;

  return (
    <DraggableBottomSheet initialSnap={mode === "network" ? 0 : mode === "route" ? 1 : 2}>
      {mode === "network" ? (
        <>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {dictionary.map.networkOverview}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {dictionary.map.allRoutes}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {routes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectRoute(route.id)}
                className="rounded-[26px] border border-white/60 bg-white/88 p-4 text-left shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: route.color }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {route.family.replace("-", " ")}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                      {route.localizedLabel?.[locale] ?? route.label}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {route.startTime} to {route.arrivalTime} · {route.estimatedRideMinutes}{" "}
                      {dictionary.common.minutes}
                    </p>
                  </div>
                  <Tag color={route.isLateService ? "blue" : "gold"}>{serviceTag(route, dictionary)}</Tag>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <Card className="mb-4 rounded-[28px] border-white/60 bg-white/92 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {dictionary.map.routeDetails}
                </p>
                <h2 className="mt-2 text-[1.8rem] font-semibold tracking-tight text-slate-950">
                  {selectedStop ? selectedStop.name : selectedRoute.localizedLabel?.[locale] ?? selectedRoute.label}
                </h2>
                <p className="mt-2 text-base text-slate-500">
                  {selectedStop ? `${selectedStop.area}, Singapore` : selectedRoute.startTime}
                </p>
              </div>
              <Button type="default" shape="circle" onClick={onBack} aria-label={dictionary.map.back}>
                <span aria-hidden="true">←</span>
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Tag color="green">{selectedRoute.localizedLabel?.[locale] ?? selectedRoute.label}</Tag>
              <Tag color={selectedRoute.isLateService ? "blue" : "gold"}>
                {serviceTag(selectedRoute, dictionary)}
              </Tag>
              <Tag color="default">
                {selectedRoute.stopCount} {dictionary.common.stops}
              </Tag>
            </div>

            <Divider className="my-4" />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {dictionary.map.estimatedRide}
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {selectedRoute.estimatedRideMinutes} {dictionary.common.minutes}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {dictionary.map.serviceWindow}
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {selectedRoute.startTime} - {selectedRoute.arrivalTime}
                </p>
              </div>
            </div>

            <Button className="mt-4" type="default" href={selectedRoute.googleMapsUrl} target="_blank">
              {dictionary.map.openInMaps}
            </Button>
          </Card>

          {selectedStop ? (
            <Card className="mb-4 rounded-[28px] bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                {dictionary.map.selectedPickup}
              </p>
              <h3 className="mt-2 text-xl font-semibold">{selectedStop.name}</h3>
              <p className="mt-2 text-sm text-slate-300">
                {selectedStop.area}
                {selectedStop.stopCode ? ` · ${dictionary.common.stopCode} ${selectedStop.stopCode}` : ""}
              </p>
            </Card>
          ) : null}

          <Card className="rounded-[28px] border-white/60 bg-white/92 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {dictionary.map.routeTimeline}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {dictionary.map.selectedStop}
                </p>
              </div>
              <Button type="link" onClick={() => onBack()}>
                {dictionary.map.browseRoutes}
              </Button>
            </div>

            {selectedRoute.stops.length > 0 ? (
              <Steps
                direction="vertical"
                current={Math.max(currentStepIndex, 0)}
                items={selectedRoute.stops.map((routeStop) => {
                  const stop = stopsById[routeStop.stopId];
                  const active = selectedStop?.id === stop.id;

                  return {
                    title: (
                      <button
                        type="button"
                        onClick={() => onSelectStop(selectedRoute.id, stop.id)}
                        className={`w-full rounded-[18px] px-3 py-2 text-left transition ${
                          active ? "bg-[#ecfdf5]" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="block text-sm font-semibold text-slate-950">
                          {stop.localizedName?.[locale] ?? stop.name}
                        </span>
                      </button>
                    ),
                    description: (
                      <div className="pb-3 pl-3 text-sm text-slate-500">
                        <span>{routeStop.scheduledTime}</span>
                        <span className="mx-1.5">·</span>
                        <span>{stop.area}</span>
                        {routeStop.isCampus ? (
                          <>
                            <span className="mx-1.5">·</span>
                            <span>{dictionary.common.campus}</span>
                          </>
                        ) : null}
                      </div>
                    ),
                  };
                })}
              />
            ) : (
              <Empty description={dictionary.common.noStopSelected} />
            )}

            <div className="mt-5 rounded-[24px] bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-[#2563eb]">
                <span>{dictionary.map.notePlaceholder}</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg shadow-sm">+</span>
              </div>
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                className="mt-3"
                placeholder={dictionary.map.notePlaceholder}
              />
              <Button
                type="primary"
                size="large"
                className="mt-4 h-14 w-full rounded-full bg-[#0abf53] shadow-[0_20px_40px_rgba(10,191,83,0.22)] hover:!bg-[#09b14e]"
              >
                {dictionary.map.savePickup}
              </Button>
            </div>
          </Card>
        </>
      )}
    </DraggableBottomSheet>
  );
}
