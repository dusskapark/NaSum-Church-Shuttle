"use client";

import L, { type Map as LeafletMap } from "leaflet";
import { useEffect, useMemo, useRef } from "react";

import { stopsById } from "@/lib/mock/stops";
import type { RouteVariant } from "@/types/shuttle";

interface ShuttleMapProps {
  route: RouteVariant;
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
}

export function ShuttleMap({ route, selectedStopId, onSelectStop }: ShuttleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const points = useMemo(
    () => route.stops.map((entry) => stopsById[entry.stopId]).map((stop) => [stop.lat, stop.lng] as [number, number]),
    [route],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: [1.325754, 103.813171],
      zoom: 11,
      zoomControl: false,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      layerRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;

    if (!map || !layer) {
      return;
    }

    layer.clearLayers();

    L.polyline(points, {
      color: route.color,
      opacity: 0.95,
      weight: 6,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(layer);

    route.stops.forEach((stopEntry) => {
      const stop = stopsById[stopEntry.stopId];
      const active = selectedStopId === stop.id;
      const marker = L.circleMarker([stop.lat, stop.lng], {
        color: active ? "#ffffff" : route.color,
        weight: active ? 3 : 2,
        fillColor: active ? "#0f172a" : "#ffffff",
        fillOpacity: 1,
        radius: active ? 9 : 6,
      });

      marker.bindTooltip(`${stopEntry.order}. ${stop.name}`, {
        direction: "top",
        offset: [0, -8],
      });
      marker.on("click", () => onSelectStop(stop.id));
      marker.addTo(layer);
    });

    const selected = selectedStopId ? stopsById[selectedStopId] : null;
    if (selected) {
      map.setView([selected.lat, selected.lng], 13.8, { animate: true });
      return;
    }

    map.fitBounds(points, {
      paddingTopLeft: [16, 16],
      paddingBottomRight: [16, 16],
      animate: true,
    });
  }, [onSelectStop, points, route, selectedStopId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
