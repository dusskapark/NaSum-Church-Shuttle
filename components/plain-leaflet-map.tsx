"use client";

import L, { type LatLngBoundsExpression, type Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef } from "react";

import { stopsById } from "@/lib/mock/stops";
import type { MapMode, RouteVariant } from "@/types/shuttle";

interface MiniMapProps {
  mode: MapMode;
  routes: RouteVariant[];
  selectedRouteId: string;
  selectedStopId: string | null;
  focusNonce?: number;
  onSelectRoute: (routeId: string) => void;
  onSelectStop: (routeId: string, stopId: string) => void;
}

function getRoutePoints(route: RouteVariant): [number, number][] {
  return route.stops.map((routeStop) => {
    const stop = stopsById[routeStop.stopId];
    return [stop.lat, stop.lng];
  });
}

export default function MiniMap({
  mode,
  routes,
  selectedRouteId,
  selectedStopId,
  focusNonce = 0,
  onSelectRoute,
  onSelectStop,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const stopLayerRef = useRef<L.LayerGroup | null>(null);

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? routes[0],
    [routes, selectedRouteId],
  );

  const visibleStopIds = useMemo(
    () =>
      mode === "network"
        ? Array.from(
            new Set(routes.flatMap((route) => route.stops.map((item) => item.stopId))),
          )
        : selectedRoute.stops.map((item) => item.stopId),
    [mode, routes, selectedRoute],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: [1.325754, 103.813171],
      zoom: 12,
      zoomControl: false,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    stopLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      routeLayerRef.current?.clearLayers();
      stopLayerRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      stopLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const stopLayer = stopLayerRef.current;

    if (!map || !routeLayer || !stopLayer) {
      return;
    }

    routeLayer.clearLayers();
    stopLayer.clearLayers();

    routes.forEach((route) => {
      const active = route.id === selectedRoute.id;
      const muted = mode !== "network" && !active;

      const polyline = L.polyline(getRoutePoints(route), {
        color: route.color,
        opacity: muted ? 0.16 : active ? 0.9 : 0.42,
        weight: active ? 7 : 4,
        lineCap: "round",
        lineJoin: "round",
      });

      polyline.on("click", () => onSelectRoute(route.id));
      polyline.addTo(routeLayer);
    });

    visibleStopIds.forEach((stopId) => {
      const stop = stopsById[stopId];
      const linkedRoute =
        routes.find((route) =>
          route.stops.some((routeStop) => routeStop.stopId === stopId),
        ) ?? selectedRoute;
      const active = selectedStopId === stopId;

      const marker = L.circleMarker([stop.lat, stop.lng], {
        color: active ? "#0f172a" : linkedRoute.color,
        weight: active ? 3 : 2,
        fillColor: active ? "#ffffff" : linkedRoute.color,
        fillOpacity: active ? 0.96 : 0.84,
        radius: active ? 10 : 6,
      });

      marker.bindTooltip(stop.name, {
        direction: "top",
        offset: [0, -10],
        opacity: 0.92,
      });
      marker.on("click", () => onSelectStop(linkedRoute.id, stopId));
      marker.addTo(stopLayer);
    });

    const allPoints = routes.flatMap((route) => getRoutePoints(route));
    const selectedPoints = getRoutePoints(selectedRoute);
    const selectedStop = selectedStopId ? stopsById[selectedStopId] : null;

    if (mode === "stop" && selectedStop) {
      map.setView([selectedStop.lat, selectedStop.lng], 13.7, { animate: true });
      return;
    }

    const fitPoints =
      mode === "route" ? selectedPoints : allPoints;

    if (fitPoints.length > 1) {
      map.fitBounds(fitPoints as LatLngBoundsExpression, {
        animate: true,
        paddingTopLeft: [28, mode === "route" ? 140 : 128],
        paddingBottomRight: [28, mode === "route" ? 360 : 320],
      });
    }
  }, [
    focusNonce,
    mode,
    onSelectRoute,
    onSelectStop,
    routes,
    selectedRoute,
    selectedStopId,
    visibleStopIds,
  ]);

  return <div ref={containerRef} className="h-full w-full" />;
}
