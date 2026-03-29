"use client";

import { Button, Card } from "antd";

import type { Dictionary } from "@/lib/i18n/messages";
import type { MiniAppTab } from "@/types/shuttle";

interface BottomNavProps {
  activeTab: MiniAppTab;
  dictionary: Dictionary;
  onChange: (tab: MiniAppTab) => void;
}

function iconFor(tab: MiniAppTab) {
  if (tab === "map") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.75 6.75 8.75 4l6.5 2.5 5-2.25v13L15.25 20l-6.5-2.5-5 2.25v-13Z" />
        <path d="M8.75 4v13.5" />
        <path d="M15.25 6.5V20" />
      </svg>
    );
  }

  if (tab === "search") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="6.25" />
        <path d="m16 16 4.25 4.25" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.75a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z" />
      <path d="M4.75 20.25a7.25 7.25 0 1 1 14.5 0" />
    </svg>
  );
}

export function BottomNav({ activeTab, dictionary, onChange }: BottomNavProps) {
  const items: { id: MiniAppTab; label: string }[] = [
    { id: "map", label: dictionary.tabs.map },
    { id: "search", label: dictionary.tabs.search },
    { id: "settings", label: dictionary.tabs.settings },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] px-4 pb-4">
      <Card className="pointer-events-auto mx-auto max-w-md rounded-[30px] border-white/55 bg-white/84 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const active = item.id === activeTab;

            return (
              <Button
                key={item.id}
                type={active ? "primary" : "text"}
                onClick={() => onChange(item.id)}
                className={`h-auto min-h-16 rounded-[24px] px-3 py-3 ${
                  active
                    ? "shadow-[0_14px_28px_rgba(15,23,42,0.22)]"
                    : "text-slate-600"
                }`}
              >
                <span className="flex flex-col items-center gap-1.5">
                  {iconFor(item.id)}
                  <span className="text-xs font-medium">{item.label}</span>
                </span>
              </Button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
