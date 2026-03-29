"use client";

import { Avatar, Card, Descriptions, Divider, Segmented, Tag } from "antd";

import { DraggableBottomSheet } from "@/components/draggable-bottom-sheet";
import type { Dictionary } from "@/lib/i18n/messages";
import { mockLineProfile } from "@/lib/mock/user-preference";
import type { Locale, MiniAppTab, RouteVariant, Stop } from "@/types/shuttle";

interface SettingsPanelProps {
  appVersion: string;
  dictionary: Dictionary;
  locale: Locale;
  selectedRoute: RouteVariant;
  selectedStop: Stop | null;
  sourceVersion: string;
  lastViewedTab: MiniAppTab;
  onLocaleChange: (locale: Locale) => void;
}

export function SettingsPanel({
  appVersion,
  dictionary,
  locale,
  selectedRoute,
  selectedStop,
  sourceVersion,
  lastViewedTab,
  onLocaleChange,
}: SettingsPanelProps) {
  const initials = mockLineProfile.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DraggableBottomSheet initialSnap={1}>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              {dictionary.tabs.settings}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {dictionary.settings.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{dictionary.settings.subtitle}</p>
          </div>

          <Card className="rounded-[28px] bg-slate-950 text-white">
            <div className="flex items-center gap-4">
              <Avatar size={56} className="bg-white/12 text-base font-semibold text-white">
                {initials}
              </Avatar>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  {dictionary.settings.profile}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{mockLineProfile.displayName}</h3>
                <p className="mt-1 text-sm text-slate-300">{mockLineProfile.handle}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300">{mockLineProfile.statusMessage}</p>
          </Card>

          <Card className="mt-4 rounded-[28px]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {dictionary.settings.language}
            </p>
            <p className="mt-2 text-sm text-slate-600">{dictionary.settings.localeReady}</p>
            <Segmented<Locale>
              className="mt-4"
              block
              size="large"
              value={locale}
              onChange={(value) => onLocaleChange(value)}
              options={[
                { label: dictionary.settings.english, value: "en" },
                { label: dictionary.settings.korean, value: "ko" },
              ]}
            />
          </Card>

          <Card className="mt-4 rounded-[28px]">
            <Descriptions
              column={1}
              size="small"
              labelStyle={{ width: "42%" }}
              items={[
                { key: "route", label: dictionary.settings.preferredRoute, children: selectedRoute.label },
                {
                  key: "stop",
                  label: dictionary.settings.preferredStop,
                  children: selectedStop?.name ?? dictionary.common.noStopSelected,
                },
                { key: "version", label: dictionary.settings.version, children: appVersion },
                { key: "tab", label: dictionary.settings.lastTab, children: lastViewedTab },
                { key: "data", label: dictionary.settings.dataVersion, children: sourceVersion },
                { key: "source", label: dictionary.settings.sourceType, children: "pdf + google maps" },
              ]}
            />
            <Divider className="my-4" />
            <div className="flex flex-wrap gap-2">
              <Tag color="default">{selectedRoute.label}</Tag>
              {selectedStop ? <Tag color="default">{selectedStop.name}</Tag> : null}
            </div>
          </Card>
    </DraggableBottomSheet>
  );
}
