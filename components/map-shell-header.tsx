"use client";

import { Button, Card, Input, Tag } from "antd";

import type { Dictionary } from "@/lib/i18n/messages";
import type { RouteVariant, Stop } from "@/types/shuttle";

interface SearchResult {
  routeId: string;
  routeLabel: string;
  stop: Stop;
}

interface MapShellHeaderProps {
  dictionary: Dictionary;
  selectedRoute: RouteVariant;
  selectedStop: Stop | null;
  modeLabel: string;
  isLiffClient: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  onBack: () => void;
  onOpenSettings: () => void;
  onSearchChange: (value: string) => void;
  onSelectSearchResult: (routeId: string, stopId: string) => void;
}

export function MapShellHeader({
  dictionary,
  selectedRoute,
  selectedStop,
  modeLabel,
  isLiffClient,
  searchQuery,
  searchResults,
  onBack,
  onOpenSettings,
  onSearchChange,
  onSelectSearchResult,
}: MapShellHeaderProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[520] px-4 pt-4">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          {!isLiffClient ? (
            <Button
              type="default"
              shape="circle"
              size="large"
              onClick={onBack}
              aria-label={dictionary.map.back}
              className="pointer-events-auto shrink-0 border-white/60 bg-white/92 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
            >
              <span aria-hidden="true">←</span>
            </Button>
          ) : null}

          <div className="pointer-events-auto min-w-0 flex-1 rounded-[30px] border border-white/60 bg-white/92 px-4 py-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f0ff] text-[#2563eb]">
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="5.5" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              </span>
              <Input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                variant="borderless"
                placeholder={dictionary.map.pickupSearchPlaceholder}
                className="min-w-0 text-base font-medium text-slate-950"
              />
            </div>
          </div>

          <Button
            type="default"
            shape="circle"
            size="large"
            onClick={onOpenSettings}
            aria-label={dictionary.map.settings}
            className="pointer-events-auto shrink-0 border-white/60 bg-white/92 shadow-[0_18px_50px_rgba(15,23,42,0.16)]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
              <path d="m4.5 13.5.92.53a1 1 0 0 1 .48.87v1.06a1 1 0 0 0 1 1h1.06a1 1 0 0 1 .87.48l.53.92a1 1 0 0 0 1.73 0l.53-.92a1 1 0 0 1 .87-.48h1.06a1 1 0 0 0 1-1V14.9a1 1 0 0 1 .48-.87l.92-.53a1 1 0 0 0 0-1.73l-.92-.53a1 1 0 0 1-.48-.87V8.81a1 1 0 0 0-1-1h-1.06a1 1 0 0 1-.87-.48l-.53-.92a1 1 0 0 0-1.73 0l-.53.92a1 1 0 0 1-.87.48H6.9a1 1 0 0 0-1 1v1.06a1 1 0 0 1-.48.87l-.92.53a1 1 0 0 0 0 1.73Z" />
            </svg>
          </Button>
        </div>

        <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2">
          <Tag color="blue">{selectedRoute.label}</Tag>
          <Tag color="default">{modeLabel}</Tag>
          {selectedStop ? <Tag color="green">{selectedStop.name}</Tag> : null}
        </div>

        {searchQuery.trim() ? (
          <Card className="pointer-events-auto mt-3 rounded-[28px] border-white/55 bg-white/94 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {dictionary.map.searchResults}
            </p>
            <div className="mt-3 space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={`${result.routeId}-${result.stop.id}`}
                    type="button"
                    onClick={() => onSelectSearchResult(result.routeId, result.stop.id)}
                    className="flex w-full items-start justify-between rounded-[22px] bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">
                        {result.stop.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {result.stop.area} · {result.routeLabel}
                      </p>
                    </div>
                    <span className="text-slate-400">→</span>
                  </button>
                ))
              ) : (
                <p className="rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {dictionary.map.searchEmpty}
                </p>
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
