"use client";

import { Button, Card, Empty, Input, List, Tag } from "antd";
import { useMemo, useState } from "react";

import { DraggableBottomSheet } from "@/components/draggable-bottom-sheet";
import type { Dictionary } from "@/lib/i18n/messages";
import { stops } from "@/lib/mock/stops";
import type { Locale, RouteVariant } from "@/types/shuttle";

interface SearchPanelProps {
  dictionary: Dictionary;
  locale: Locale;
  routes: RouteVariant[];
  selectedRouteId: string;
  onSelectStop: (routeId: string, stopId: string) => void;
}

export function SearchPanel({
  dictionary,
  locale,
  routes,
  selectedRouteId,
  onSelectStop,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");

  const filteredStops = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return stops.filter((stop) => {
      if (!normalizedQuery) {
        return true;
      }

      const servingRoutes = routes
        .filter((route) => route.stops.some((routeStop) => routeStop.stopId === stop.id))
        .map((route) => route.label.toLowerCase());

      const haystack = [
        stop.name.toLowerCase(),
        stop.area.toLowerCase(),
        ...stop.aliases.map((alias) => alias.toLowerCase()),
        ...servingRoutes,
      ];

      return haystack.some((value) => value.includes(normalizedQuery));
    });
  }, [query, routes]);

  return (
    <DraggableBottomSheet initialSnap={1}>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {dictionary.tabs.search}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {dictionary.search.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{dictionary.search.subtitle}</p>
          </div>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dictionary.search.placeholder}
            size="large"
          />

          <div className="mt-4">
            {filteredStops.length === 0 ? (
              <Card className="rounded-[24px]">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <p className="font-medium text-slate-950">{dictionary.search.emptyTitle}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        {dictionary.search.emptyDescription}
                      </p>
                    </div>
                  }
                />
              </Card>
            ) : (
              <List
                dataSource={filteredStops}
                renderItem={(stop) => {
                  const servingRoutes = routes.filter((route) =>
                    route.stops.some((routeStop) => routeStop.stopId === stop.id),
                  );
                  const preferredRoute =
                    servingRoutes.find((route) => route.id === selectedRouteId) ??
                    servingRoutes[0];

                  return (
                    <List.Item className="border-0 px-0 py-1.5">
                      <Card className="w-full rounded-[24px]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold text-slate-950">
                              {stop.localizedName?.[locale] ?? stop.name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">{stop.area}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {servingRoutes.map((route) => (
                                <Tag key={`${stop.id}-${route.id}`} color="default">
                                  {route.localizedLabel?.[locale] ?? route.label}
                                </Tag>
                              ))}
                            </div>
                          </div>
                          <Button type="primary" onClick={() => onSelectStop(preferredRoute.id, stop.id)}>
                            {dictionary.search.jump}
                          </Button>
                        </div>
                      </Card>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
    </DraggableBottomSheet>
  );
}
