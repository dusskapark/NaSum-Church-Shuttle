"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  List,
  Segmented,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from "antd";

import { routes } from "@/lib/mock/routes";
import { stopsById } from "@/lib/mock/stops";

const { Paragraph, Text, Title } = Typography;

const ShuttleMap = dynamic(() => import("@/components/shuttle-map").then((module) => module.ShuttleMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-slate-500">Loading map...</div>,
});

type RiderTab = "home" | "scan" | "history" | "my";

interface ScanHistory {
  id: string;
  routeId: string;
  stopId: string;
  timestamp: string;
  status: "success" | "duplicate" | "fail";
  reason?: string;
}

const mockHistory: ScanHistory[] = [
  { id: "evt-1", routeId: "south-a", stopId: "opp-great-world-city", timestamp: "2026-03-29 09:06", status: "success" },
  { id: "evt-2", routeId: "south-a", stopId: "botanic-gdns-f65-taxi-stand", timestamp: "2026-03-22 09:24", status: "duplicate", reason: "이미 등록된 탑승 기록" },
  { id: "evt-3", routeId: "north-centre-a", stopId: "opp-serangoon-stn-exit-f", timestamp: "2026-03-15 09:04", status: "fail", reason: "QR payload 검증 실패" },
];

export function LiffShuttleApp({ appVersion }: { appVersion: string }) {
  const [activeTab, setActiveTab] = useState<RiderTab>("home");
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0].id);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? routes[0],
    [selectedRouteId],
  );

  const stopResults = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return selectedRoute.stops.filter((entry) => {
      const stop = stopsById[entry.stopId];
      if (!normalized) {
        return true;
      }
      return [stop.name, stop.area, ...stop.aliases].some((token) => token.toLowerCase().includes(normalized));
    });
  }, [search, selectedRoute]);

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-[#0b1220] text-slate-100">
      <header className="border-b border-white/10 bg-[#0f1729] px-5 pb-4 pt-6">
        <Space direction="vertical" size={2} className="w-full">
          <Text className="text-[11px] uppercase tracking-[0.28em] !text-sky-200/80">NaSum Church Shuttle</Text>
          <div className="flex items-start justify-between gap-2">
            <Title level={4} className="!m-0 !text-white">LIFF Shuttle MVP</Title>
            <Tag color="cyan">v{appVersion}</Tag>
          </div>
          <Text className="!text-slate-300">Project plan 기반 IA(홈/스캔/히스토리/마이)로 프론트엔드를 재구성했습니다.</Text>
        </Space>
      </header>

      <section className="grid grid-cols-3 gap-2 bg-[#0f1729] px-4 py-3">
        <Card size="small" className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 12 } }}>
          <Statistic title="오늘 운행" value="11" valueStyle={{ color: "#e2e8f0", fontSize: 20 }} />
        </Card>
        <Card size="small" className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 12 } }}>
          <Statistic title="성공률" value={96.4} suffix="%" valueStyle={{ color: "#e2e8f0", fontSize: 20 }} />
        </Card>
        <Card size="small" className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 12 } }}>
          <Statistic title="실패 이벤트" value={7} valueStyle={{ color: "#fda4af", fontSize: 20 }} />
        </Card>
      </section>

      <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4">
        {activeTab === "home" && (
          <Space direction="vertical" size={12} className="w-full">
            <Card className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 16 } }}>
              <Space direction="vertical" size={12} className="w-full">
                <Segmented
                  block
                  value={selectedRouteId}
                  options={routes.slice(0, 6).map((route) => ({ label: route.label.replace(" Line ", " "), value: route.id }))}
                  onChange={(value) => {
                    setSelectedRouteId(String(value));
                    setSelectedStopId(null);
                  }}
                />
                <div className="h-56 overflow-hidden rounded-2xl border border-white/10">
                  <ShuttleMap route={selectedRoute} selectedStopId={selectedStopId} onSelectStop={setSelectedStopId} />
                </div>
                <Button type="primary" size="large" block onClick={() => setActiveTab("scan")}>탑승 스캔 시작</Button>
              </Space>
            </Card>
          </Space>
        )}

        {activeTab === "scan" && (
          <Space direction="vertical" size={12} className="w-full">
            <Card className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 16 } }}>
              <Space direction="vertical" size={10} className="w-full">
                <Title level={5} className="!m-0 !text-white">1) 노선/정류장 선택</Title>
                <Input placeholder="정류장 검색" value={search} onChange={(event) => setSearch(event.target.value)} />
                <List
                  itemLayout="horizontal"
                  dataSource={stopResults}
                  renderItem={(entry) => {
                    const stop = stopsById[entry.stopId];
                    const selected = selectedStopId === stop.id;
                    return (
                      <List.Item
                        className="cursor-pointer"
                        onClick={() => setSelectedStopId(stop.id)}
                        extra={selected ? <Tag color="green">선택됨</Tag> : null}
                      >
                        <List.Item.Meta title={`${entry.order}. ${stop.name}`} description={`${stop.area} · ${entry.scheduledTime}`} />
                      </List.Item>
                    );
                  }}
                />
                <Button type="primary" size="large" block disabled={!selectedStopId}>QR 스캔 결과 확인 (Mock)</Button>
              </Space>
            </Card>
            <Card className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 16 } }}>
              <Title level={5} className="!mt-0 !text-white">2) 스캔 결과</Title>
              <Paragraph className="!mb-2 !text-slate-300">성공/중복/오류 상태를 즉시 표시하고 재시도 버튼을 제공합니다.</Paragraph>
              <Space wrap>
                <Tag color="success">정상 처리</Tag>
                <Tag color="warning">중복 처리</Tag>
                <Tag color="error">오류 재시도</Tag>
              </Space>
            </Card>
          </Space>
        )}

        {activeTab === "history" && (
          <Card className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 16 } }}>
            <Tabs
              items={[
                { key: "all", label: "전체" },
                { key: "success", label: "성공" },
                { key: "fail", label: "실패/중복" },
              ]}
            />
            <List
              dataSource={mockHistory}
              renderItem={(event) => {
                const route = routes.find((item) => item.id === event.routeId);
                const stop = stopsById[event.stopId];
                const color = event.status === "success" ? "success" : event.status === "duplicate" ? "warning" : "error";
                const label = event.status === "success" ? "성공" : event.status === "duplicate" ? "중복" : "실패";
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Badge color={color === "success" ? "#22c55e" : color === "warning" ? "#f59e0b" : "#ef4444"} />}
                      title={`${route?.label ?? event.routeId} · ${stop.name}`}
                      description={event.timestamp}
                    />
                    <Space direction="vertical" size={2} className="items-end">
                      <Tag color={color}>{label}</Tag>
                      {event.reason && <Text className="!text-xs !text-slate-400">{event.reason}</Text>}
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        )}

        {activeTab === "my" && (
          <Space direction="vertical" size={12} className="w-full">
            <Card className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 16 } }}>
              <List
                itemLayout="horizontal"
                dataSource={[
                  { label: "사용자", value: "LIFF Demo User" },
                  { label: "권한", value: "Rider" },
                  { label: "동의 상태", value: "개인정보 동의 완료" },
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta avatar={<Avatar>{item.label[0]}</Avatar>} title={item.label} description={item.value} />
                  </List.Item>
                )}
              />
            </Card>
            <Card className="!bg-[#172036] !text-slate-100" styles={{ body: { padding: 16 } }}>
              <Title level={5} className="!m-0 !text-white">운영자 진입 (Admin Web Entry)</Title>
              <Paragraph className="!mb-3 !mt-2 !text-slate-300">Dashboard / Events / Routes & Stops / Audit Log / Ops Check로 이동하는 관리자 링크 자리입니다.</Paragraph>
              <Button block>운영자 페이지 열기</Button>
            </Card>
          </Space>
        )}
      </div>

      <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-white/10 bg-[#0f1729]/95 px-3 pb-3 pt-2 backdrop-blur">
        <Tabs
          centered
          activeKey={activeTab}
          onChange={(value) => setActiveTab(value as RiderTab)}
          items={[
            { key: "home", label: "Home" },
            { key: "scan", label: "Scan" },
            { key: "history", label: "History" },
            { key: "my", label: "My" },
          ]}
        />
      </nav>
    </main>
  );
}
