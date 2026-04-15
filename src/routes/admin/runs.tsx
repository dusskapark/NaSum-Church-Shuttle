import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Form,
  Picker,
  Popup,
  Selector,
  Skeleton,
  Stepper,
  Steps,
  Switch,
  Tabs,
  Tag,
  Toast,
} from 'antd-mobile';
import {
  CheckCircleFill,
  ClockCircleFill,
  LocationFill,
} from 'antd-mobile-icons';
import Layout from '../../components/Layout';
import { useContainer } from '../../hooks/useContainer';
import { useTranslation } from '../../lib/useTranslation';
import { getApiBaseUrl } from '../../constants/appConfigs';
import { authedFetch } from '../../lib/api';
import { fetchApi, mutateApi } from '../../lib/queries';
import { useRoutes } from '../../hooks/useRoutes';
import { getRouteLabel, getVisibleStops } from '../../lib/routeSelectors';
import type {
  ActiveRun,
  ApiRouteWithStops,
  RunResult,
  ShuttleRun,
  StopBoardingResult,
} from '@app-types/core';

interface AutoRunConfig {
  enabled: boolean;
  days_of_week: number[]; // 0=Sun … 6=Sat
  start_time: string; // HH:MM 24h KST
  end_time: string; // HH:MM 24h KST
  updated_at: string | null;
}

// DOW labels are resolved from t at render time via t('admin.dayLabels')

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, '0')}h`,
  value: String(i).padStart(2, '0'),
}));

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  label: `${String(i).padStart(2, '0')}m`,
  value: String(i).padStart(2, '0'),
}));

const TIME_PICKER_COLUMNS = [HOUR_OPTIONS, MINUTE_OPTIONS];

function timeToPickerValue(hhmm: string): [string, string] {
  const [h = '08', m = '00'] = hhmm.split(':');
  return [h, m];
}

function pickerValueToTime(val: (string | number | null)[]): string {
  return `${val[0] ?? '08'}:${val[1] ?? '00'}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

interface RunRowProps {
  route: ApiRouteWithStops;
  activeRun: ActiveRun | null;
  t: ReturnType<typeof useTranslation>;
  onRefresh: () => void;
  onViewResults: (runId: string, title: string) => void;
}

interface StopOverrideModal {
  stopId: string;
  stopName: string;
  currentStatus: 'arrived' | 'waiting';
  currentPassengers: number;
}

function RunRow({
  route,
  activeRun,
  t,
  onRefresh,
  onViewResults,
}: RunRowProps) {
  const [busy, setBusy] = useState(false);
  const [overrideModal, setOverrideModal] = useState<StopOverrideModal | null>(
    null,
  );
  const [modalStatus, setModalStatus] = useState<'arrived' | 'waiting'>(
    'arrived',
  );
  const [modalIsProcess, setModalIsProcess] = useState(false);
  const [modalPassengers, setModalPassengers] = useState(0);
  const [modalPassengersEnabled, setModalPassengersEnabled] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);

  const openOverrideModal = (
    s: { route_stop_id: string; status: string; total_passengers: number },
    isProcess = false,
  ) => {
    const stopName = stopMap.get(s.route_stop_id) ?? s.route_stop_id;
    setOverrideModal({
      stopId: s.route_stop_id,
      stopName,
      currentStatus: s.status as 'arrived' | 'waiting',
      currentPassengers: s.total_passengers,
    });
    setModalIsProcess(isProcess);
    setModalStatus(s.status as 'arrived' | 'waiting');
    setModalPassengers(s.total_passengers);
    setModalPassengersEnabled(false);
  };

  const handleApplyOverride = useCallback(async () => {
    if (!activeRun || !overrideModal) return;
    setModalBusy(true);
    try {
      const body: Record<string, unknown> = { status: modalStatus };
      if (modalPassengersEnabled)
        body.total_passengers_override = modalPassengers;
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/runs/${activeRun.run_id}/stops/${overrideModal.stopId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOverrideModal(null);
      onRefresh();
    } catch {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    } finally {
      setModalBusy(false);
    }
  }, [
    activeRun,
    overrideModal,
    modalStatus,
    modalPassengers,
    modalPassengersEnabled,
    t,
    onRefresh,
  ]);

  const handleResetOverride = useCallback(async () => {
    if (!activeRun || !overrideModal) return;
    setModalBusy(true);
    try {
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/runs/${activeRun.run_id}/stops/${overrideModal.stopId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reset: true }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOverrideModal(null);
      onRefresh();
    } catch {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    } finally {
      setModalBusy(false);
    }
  }, [activeRun, overrideModal, t, onRefresh]);

  const handleStartRun = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authedFetch(`${getApiBaseUrl()}/api/v1/admin/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route_code: route.route_code }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Toast.show({ content: t('admin.runStarted'), icon: 'success' });
      onRefresh();
    } catch {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    } finally {
      setBusy(false);
    }
  }, [route.route_code, t, onRefresh]);

  const handleEndRun = useCallback(async () => {
    if (!activeRun) return;
    setBusy(true);
    try {
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/runs/${activeRun.run_id}/end`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Toast.show({ content: t('admin.runEnded'), icon: 'success' });
      onRefresh();
    } catch {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    } finally {
      setBusy(false);
    }
  }, [activeRun, t, onRefresh]);

  const routeLabel = getRouteLabel(route);
  const visibleStops = getVisibleStops(route);
  const stopMap = new Map(
    visibleStops.map((s) => [s.id, s.place.display_name ?? s.place.name]),
  );

  return (
    <div
      style={{
        borderBottom: '1px solid var(--app-color-border)',
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontWeight: 600 }}>{routeLabel}</div>
          {activeRun && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 4,
              }}
            >
              <Tag color="success" fill="solid">
                {t('checkin.inService')}
              </Tag>
              <span style={{ color: 'var(--app-color-subtle-text)' }}>
                {t('admin.boardingCount', {
                  count: activeRun.stop_states.reduce(
                    (sum, s) => sum + s.total_passengers,
                    0,
                  ),
                })}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {activeRun ? (
            <>
              <Button
                size="small"
                color="default"
                onClick={() => onViewResults(activeRun.run_id, routeLabel)}
              >
                {t('admin.viewResults')}
              </Button>
              <Button
                size="small"
                color="danger"
                loading={busy}
                onClick={() => handleEndRun()}
              >
                {t('admin.endRun')}
              </Button>
            </>
          ) : (
            <Button
              size="small"
              color="primary"
              loading={busy}
              onClick={() => handleStartRun()}
            >
              {t('admin.createRun')}
            </Button>
          )}
        </div>
      </div>

      {activeRun && (
        <div style={{ marginTop: 4 }}>
          {(() => {
            const stateMap = new Map(
              activeRun.stop_states.map((s) => [s.route_stop_id, s]),
            );
            const lastArrivedIndex = visibleStops.reduce((last, stop, idx) => {
              return stateMap.get(stop.id)?.status === 'arrived' ? idx : last;
            }, -1);

            return (
              <Steps
                direction="vertical"
                current={
                  lastArrivedIndex >= 0 ? lastArrivedIndex + 1 : undefined
                }
                style={
                  {
                    '--icon-size': '16px',
                    '--indicator-margin-right': '12px',
                  } as React.CSSProperties
                }
              >
                {visibleStops.map((stop, index) => {
                  const state = stateMap.get(stop.id);
                  const isArrived = state?.status === 'arrived';
                  const passengers = state?.total_passengers ?? 0;

                  let stepStatus: 'finish' | 'process' | 'wait';
                  let icon: React.ReactNode;
                  if (index <= lastArrivedIndex) {
                    stepStatus = 'finish';
                    icon = (
                      <CheckCircleFill
                        style={{ color: 'var(--adm-color-success)' }}
                      />
                    );
                  } else if (
                    lastArrivedIndex >= 0 &&
                    index === lastArrivedIndex + 1
                  ) {
                    stepStatus = 'process';
                    icon = (
                      <LocationFill
                        style={{ color: 'var(--adm-color-primary)' }}
                      />
                    );
                  } else {
                    stepStatus = 'wait';
                    icon = (
                      <ClockCircleFill
                        style={{ color: 'var(--adm-color-border)' }}
                      />
                    );
                  }

                  return (
                    <Steps.Step
                      key={stop.id}
                      status={stepStatus}
                      icon={icon}
                      title={
                        <span
                          onClick={() =>
                            openOverrideModal(
                              {
                                route_stop_id: stop.id,
                                status: state?.status ?? 'waiting',
                                total_passengers: passengers,
                              },
                              stepStatus === 'process',
                            )
                          }
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          {stop.place.display_name ?? stop.place.name}
                        </span>
                      }
                      description={`${isArrived ? t('checkin.arrived') : t('checkin.waiting')} · ${t('checkin.totalPassengers', { count: passengers })}`}
                    />
                  );
                })}
              </Steps>
            );
          })()}
        </div>
      )}

      <Popup
        visible={overrideModal !== null}
        onMaskClick={() => setOverrideModal(null)}
        bodyStyle={{
          borderRadius: '12px 12px 0 0',
          padding: 'calc(16px + env(safe-area-inset-bottom, 0px)) 16px 16px',
        }}
      >
        {overrideModal && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{overrideModal.stopName}</div>
              <div
                style={{ color: 'var(--app-color-subtle-text)', marginTop: 2 }}
              >
                Override boarding state for testing
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  color: 'var(--app-color-subtle-text)',
                  marginBottom: 6,
                }}
              >
                Status
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(['arrived', 'waiting'] as const).map((s) => (
                  <Button
                    key={s}
                    size="small"
                    color={
                      !modalIsProcess && modalStatus === s
                        ? 'primary'
                        : 'default'
                    }
                    onClick={() => {
                      setModalStatus(s);
                      setModalIsProcess(false);
                    }}
                  >
                    {s === 'arrived'
                      ? t('checkin.arrived')
                      : t('checkin.waiting')}
                  </Button>
                ))}
                <Button
                  size="small"
                  color={modalIsProcess ? 'primary' : 'default'}
                  disabled
                  style={{ opacity: modalIsProcess ? 1 : 0.4 }}
                >
                  {t('checkin.inProgress')}
                </Button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <div style={{ color: 'var(--app-color-subtle-text)' }}>
                  Override passenger count
                </div>
                <Switch
                  checked={modalPassengersEnabled}
                  onChange={setModalPassengersEnabled}
                />
              </div>
              {modalPassengersEnabled && (
                <Stepper
                  min={0}
                  max={99}
                  value={modalPassengers}
                  onChange={(v) => setModalPassengers(v)}
                  style={
                    {
                      '--height': '36px',
                      '--input-width': '48px',
                    } as React.CSSProperties
                  }
                />
              )}
              {!modalPassengersEnabled && (
                <div style={{ color: 'var(--app-color-subtle-text)' }}>
                  Using actual scan count ({overrideModal.currentPassengers})
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                block
                fill="outline"
                color="default"
                loading={modalBusy}
                onClick={handleResetOverride}
              >
                Reset to natural
              </Button>
              <Button
                block
                color="primary"
                loading={modalBusy}
                onClick={handleApplyOverride}
              >
                Apply
              </Button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}

interface RunResultsPanelProps {
  result: RunResult;
  stopMap: Map<string, string>;
  t: ReturnType<typeof useTranslation>;
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--adm-color-weak)',
  background: 'var(--adm-color-box)',
  borderBottom: '1px solid var(--adm-color-border)',
  whiteSpace: 'nowrap',
};

function RunResultsPanel({ result, stopMap, t }: RunResultsPanelProps) {
  const totalBoarded = result.stop_results.reduce(
    (sum, s) => sum + s.total_passengers,
    0,
  );

  // Flatten stops × riders into rows, using rowSpan for the stop columns
  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          padding: '8px 12px 6px',
          fontSize: 13,
          color: 'var(--adm-color-weak)',
        }}
      >
        {t('admin.boardingCount', { count: totalBoarded })}
      </div>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
      >
        <thead>
          <tr>
            <th style={thStyle}>Stop</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Boarded</th>
            <th style={thStyle}>Rider</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>+Extra</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Check-in Time</th>
          </tr>
        </thead>
        <tbody>
          {result.stop_results.map((stopResult: StopBoardingResult, si) => {
            const stopName =
              stopMap.get(stopResult.route_stop_id) ?? stopResult.route_stop_id;
            const isArrived = stopResult.status === 'arrived';
            const { riders } = stopResult;
            const rowCount = Math.max(riders.length, 1);
            const rowBg =
              si % 2 === 0
                ? 'var(--adm-color-background)'
                : 'var(--adm-color-box)';
            const borderTop = '1px solid var(--adm-color-border)';
            const stopCellStyle: React.CSSProperties = {
              padding: '10px 12px',
              verticalAlign: 'top',
              borderTop,
              background: rowBg,
            };

            if (riders.length === 0) {
              return (
                <tr key={stopResult.route_stop_id}>
                  <td
                    style={{
                      ...stopCellStyle,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {stopName}
                  </td>
                  <td style={stopCellStyle}>
                    <Tag
                      color={isArrived ? 'success' : 'default'}
                      fill="outline"
                    >
                      {isArrived ? t('checkin.arrived') : t('checkin.waiting')}
                    </Tag>
                  </td>
                  <td
                    style={{
                      ...stopCellStyle,
                      textAlign: 'right',
                      color: 'var(--adm-color-weak)',
                    }}
                  >
                    {stopResult.total_passengers}
                  </td>
                  <td
                    colSpan={3}
                    style={{ ...stopCellStyle, color: 'var(--adm-color-weak)' }}
                  >
                    —
                  </td>
                </tr>
              );
            }

            return riders.map((rider, ri) => (
              <tr key={`${stopResult.route_stop_id}-${rider.user_id}`}>
                {ri === 0 && (
                  <>
                    <td
                      rowSpan={rowCount}
                      style={{
                        ...stopCellStyle,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stopName}
                    </td>
                    <td rowSpan={rowCount} style={stopCellStyle}>
                      <Tag
                        color={isArrived ? 'success' : 'default'}
                        fill="outline"
                      >
                        {isArrived
                          ? t('checkin.arrived')
                          : t('checkin.waiting')}
                      </Tag>
                    </td>
                    <td
                      rowSpan={rowCount}
                      style={{
                        ...stopCellStyle,
                        textAlign: 'right',
                        color: 'var(--adm-color-weak)',
                      }}
                    >
                      {stopResult.total_passengers}
                    </td>
                  </>
                )}
                <td
                  style={{
                    padding: '10px 12px',
                    borderTop:
                      ri === 0
                        ? borderTop
                        : '1px solid var(--adm-color-border)',
                    background: rowBg,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Avatar
                      src={rider.picture_url ?? ''}
                      fallback={(rider.display_name ?? rider.user_id)
                        .charAt(0)
                        .toUpperCase()}
                      style={{
                        '--size': '24px',
                        '--border-radius': '50%',
                        flexShrink: 0,
                      }}
                    />
                    <span>{rider.display_name ?? rider.user_id}</span>
                  </div>
                </td>
                <td
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    borderTop:
                      ri === 0
                        ? borderTop
                        : '1px solid var(--adm-color-border)',
                    background: rowBg,
                  }}
                >
                  {rider.additional_passengers > 0 && (
                    <Tag color="primary" fill="outline">
                      +{rider.additional_passengers}
                    </Tag>
                  )}
                </td>
                <td
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    color: 'var(--adm-color-weak)',
                    whiteSpace: 'nowrap',
                    borderTop:
                      ri === 0
                        ? borderTop
                        : '1px solid var(--adm-color-border)',
                    background: rowBg,
                  }}
                >
                  {formatDate(rider.scanned_at)}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminRunsPage() {
  const t = useTranslation();
  useContainer(t('admin.runsSection'));

  const queryClient = useQueryClient();

  const { routes, loading: routesLoading } = useRoutes(
    t('common.routeLoadError'),
  );
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'schedule'>(
    'active',
  );

  // ── Active runs (useQuery) ────────────────────────────────────────────────
  const {
    data: activeRuns = new Map<string, ActiveRun | null>(),
    isLoading: runsLoading,
  } = useQuery({
    queryKey: ['admin', 'runs', 'active'],
    queryFn: async () => {
      const runs = await fetchApi<
        (ShuttleRun & { route_code: string; stop_states: [] })[]
      >('/api/v1/admin/runs?status=active');

      const entries = await Promise.all(
        routes.map(async (route) => {
          const activeRun = runs.find(
            (r) => r.route_code === route.route_code && r.status === 'active',
          );
          if (!activeRun) return [route.route_code, null] as const;

          try {
            const activeRunData = await fetchApi<ActiveRun | null>(
              `/api/v1/checkin/run-status?routeCode=${encodeURIComponent(route.route_code)}`,
            );
            return [route.route_code, activeRunData] as const;
          } catch {
            return [route.route_code, null] as const;
          }
        }),
      );
      return new Map(entries);
    },
    enabled: !routesLoading && routes.length > 0,
  });

  // ── Run history (useQuery) ────────────────────────────────────────────────
  const { data: runHistory = [], isLoading: runHistoryLoading } = useQuery({
    queryKey: ['admin', 'runs', 'history'],
    queryFn: async () => {
      const data = await fetchApi<(ShuttleRun & { route_code: string })[]>(
        '/api/v1/admin/runs?status=completed',
      );
      return data.slice(0, 10);
    },
    enabled: activeTab === 'history',
  });

  // ── Results full-page modal ───────────────────────────────────────────────
  const [viewingResult, setViewingResult] = useState<RunResult | null>(null);
  const [viewingResultTitle, setViewingResultTitle] = useState('');
  const [resultsLoading, setResultsLoading] = useState(false);

  const handleViewResults = useCallback(
    async (runId: string, title: string) => {
      setViewingResultTitle(title);
      setViewingResult(null);
      setResultsLoading(true);
      try {
        const data = await fetchApi<RunResult>(
          `/api/v1/admin/runs/${runId}/results`,
        );
        setViewingResult(data);
      } catch {
        Toast.show({ content: t('admin.loadError'), icon: 'fail' });
        setViewingResultTitle('');
      } finally {
        setResultsLoading(false);
      }
    },
    [t],
  );

  const allStopMap = useMemo(() => {
    const m = new Map<string, string>();
    routes.forEach((route) => {
      getVisibleStops(route).forEach((stop) => {
        m.set(stop.id, stop.place.display_name ?? stop.place.name);
      });
    });
    return m;
  }, [routes]);

  // ── Auto-run schedule (useQuery + useMutation) ────────────────────────────
  const [autoRunDraft, setAutoRunDraft] = useState<AutoRunConfig>({
    enabled: false,
    days_of_week: [0],
    start_time: '08:00',
    end_time: '12:00',
    updated_at: null,
  });

  const { data: autoRunConfig = null, isLoading: autoRunLoading } = useQuery({
    queryKey: ['admin', 'run-schedule'],
    queryFn: async () => {
      const data = await fetchApi<AutoRunConfig>('/api/v1/admin/run-schedule');
      setAutoRunDraft(data);
      return data;
    },
    enabled: activeTab === 'schedule',
  });

  const saveScheduleMutation = useMutation({
    mutationFn: () =>
      mutateApi<AutoRunConfig>('/api/v1/admin/run-schedule', {
        method: 'PUT',
        body: {
          enabled: autoRunDraft.enabled,
          days_of_week: autoRunDraft.days_of_week,
          start_time: autoRunDraft.start_time,
          end_time: autoRunDraft.end_time,
        },
      }),
    onSuccess: (updated) => {
      setAutoRunDraft(updated);
      queryClient.setQueryData(['admin', 'run-schedule'], updated);
      Toast.show({ content: t('admin.scheduleSaved'), icon: 'success' });
    },
    onError: () => {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    },
  });

  const saveAutoRunConfig = useCallback(() => {
    saveScheduleMutation.mutate();
  }, [saveScheduleMutation]);

  const autoRunSaving = saveScheduleMutation.isPending;

  const [startAllBusy, setStartAllBusy] = useState(false);

  const handleStartAllRuns = useCallback(async () => {
    const idleRoutes = routes.filter((r) => !activeRuns.get(r.route_code));
    if (idleRoutes.length === 0) {
      Toast.show({ content: t('admin.allRoutesActive'), icon: 'fail' });
      return;
    }
    setStartAllBusy(true);
    let started = 0;
    let failed = 0;
    await Promise.allSettled(
      idleRoutes.map(async (route) => {
        try {
          const res = await authedFetch(
            `${getApiBaseUrl()}/api/v1/admin/runs`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ route_code: route.route_code }),
            },
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          started += 1;
        } catch {
          failed += 1;
        }
      }),
    );
    setStartAllBusy(false);
    if (failed === 0) {
      Toast.show({
        content: t('admin.runsStartedOk', { count: started }),
        icon: 'success',
      });
    } else {
      Toast.show({
        content: t('admin.runsStartedCount', { started, failed }),
        icon: 'fail',
      });
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'runs', 'active'] });
  }, [routes, activeRuns, queryClient, t]);

  const isResultsOpen = viewingResultTitle !== '' || resultsLoading;

  return (
    <Layout showTabBar={false}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'active' | 'history')}
        style={{ '--title-font-size': '14px' }}
      >
        {/* ── Active tab ──────────────────────────────────────────────────── */}
        <Tabs.Tab title={t('admin.scheduleActiveTab')} key="active">
          {/* Start All Runs */}
          {!routesLoading && !runsLoading && routes.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid var(--adm-color-border)',
                background: 'var(--adm-color-box)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--adm-color-weak)' }}>
                {activeRuns.size > 0
                  ? `${[...activeRuns.values()].filter(Boolean).length} / ${routes.length} ${t('admin.scheduleActiveTab').toLowerCase()}`
                  : `${routes.length} ${t('admin.historyColRoute').toLowerCase()}`}
              </span>
              <Button
                size="small"
                color="primary"
                loading={startAllBusy}
                disabled={routes.every((r) => !!activeRuns.get(r.route_code))}
                onClick={handleStartAllRuns}
              >
                {t('admin.startAllRuns')}
              </Button>
            </div>
          )}

          {routesLoading || runsLoading ? (
            <div style={{ padding: '12px 16px' }}>
              <Skeleton.Paragraph lineCount={4} animated />
            </div>
          ) : routes.length === 0 ? (
            <div
              style={{ padding: '12px 16px', color: 'var(--adm-color-weak)' }}
            >
              {t('admin.noRuns')}
            </div>
          ) : (
            routes.map((route) => (
              <RunRow
                key={route.route_code}
                route={route}
                activeRun={activeRuns.get(route.route_code) ?? null}
                t={t}
                onRefresh={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['admin', 'runs', 'active'],
                  })
                }
                onViewResults={handleViewResults}
              />
            ))
          )}
        </Tabs.Tab>

        {/* ── History tab ─────────────────────────────────────────────────── */}
        <Tabs.Tab title={t('admin.scheduleHistoryTab')} key="history">
          {runHistoryLoading ? (
            <div style={{ padding: '12px 16px' }}>
              <Skeleton.Paragraph lineCount={4} animated />
            </div>
          ) : runHistory.length === 0 ? (
            <div
              style={{ padding: '12px 16px', color: 'var(--adm-color-weak)' }}
            >
              {t('admin.historyNoRuns')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: 'var(--adm-color-box)',
                      borderBottom: '1px solid var(--adm-color-border)',
                    }}
                  >
                    {[
                      t('admin.historyColRoute'),
                      t('admin.historyColStarted'),
                      t('admin.historyColEnded'),
                      '',
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: 'var(--adm-color-weak)',
                          fontSize: 12,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runHistory.map((run, i) => (
                    <tr
                      key={run.id}
                      style={{
                        background:
                          i % 2 === 0
                            ? 'var(--adm-color-background)'
                            : 'var(--adm-color-box)',
                        borderBottom: '1px solid var(--adm-color-border)',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                        {run.route_code}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          color: 'var(--adm-color-weak)',
                        }}
                      >
                        {run.started_at ? formatDate(run.started_at) : '—'}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          color: 'var(--adm-color-weak)',
                        }}
                      >
                        {run.ended_at ? formatDate(run.ended_at) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <Button
                          size="mini"
                          color="default"
                          fill="outline"
                          onClick={() =>
                            handleViewResults(run.id, run.route_code)
                          }
                        >
                          {t('admin.viewResults')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Tab>
        {/* ── Schedule tab ────────────────────────────────────────────────── */}
        <Tabs.Tab title={t('admin.scheduleTabLabel')} key="schedule">
          {autoRunLoading ? (
            <div style={{ padding: '12px 16px' }}>
              <Skeleton.Paragraph lineCount={5} animated />
            </div>
          ) : (
            <div>
              <Form layout="horizontal">
                <Form.Item
                  label={t('admin.scheduleEnabled')}
                  extra={
                    <Switch
                      checked={autoRunDraft.enabled}
                      onChange={(v) =>
                        setAutoRunDraft((d) => ({ ...d, enabled: v }))
                      }
                    />
                  }
                />

                <Form.Item label={t('admin.scheduleDays')} layout="vertical">
                  <Selector
                    columns={7}
                    multiple
                    disabled={!autoRunDraft.enabled}
                    value={autoRunDraft.days_of_week.map(String)}
                    onChange={(vals) =>
                      setAutoRunDraft((d) => ({
                        ...d,
                        days_of_week: (vals as string[])
                          .map(Number)
                          .sort((a, b) => a - b),
                      }))
                    }
                    options={(t('admin.dayLabels') as unknown as string[]).map(
                      (label, i) => ({
                        label,
                        value: String(i),
                      }),
                    )}
                    style={{ '--padding': '6px 0' }}
                  />
                </Form.Item>

                <Picker
                  columns={TIME_PICKER_COLUMNS}
                  value={timeToPickerValue(autoRunDraft.start_time)}
                  onConfirm={(val) =>
                    setAutoRunDraft((d) => ({
                      ...d,
                      start_time: pickerValueToTime(val),
                    }))
                  }
                >
                  {(_, actions) => (
                    <Form.Item
                      label={t('admin.scheduleStartTime')}
                      clickable={autoRunDraft.enabled}
                      arrow={autoRunDraft.enabled}
                      onClick={autoRunDraft.enabled ? actions.open : undefined}
                      style={
                        !autoRunDraft.enabled ? { opacity: 0.4 } : undefined
                      }
                      extra={
                        <span style={{ color: 'var(--adm-color-weak)' }}>
                          {autoRunDraft.start_time}
                        </span>
                      }
                    />
                  )}
                </Picker>

                <Picker
                  columns={TIME_PICKER_COLUMNS}
                  value={timeToPickerValue(autoRunDraft.end_time)}
                  onConfirm={(val) =>
                    setAutoRunDraft((d) => ({
                      ...d,
                      end_time: pickerValueToTime(val),
                    }))
                  }
                >
                  {(_, actions) => (
                    <Form.Item
                      label={t('admin.scheduleEndTime')}
                      clickable={autoRunDraft.enabled}
                      arrow={autoRunDraft.enabled}
                      onClick={autoRunDraft.enabled ? actions.open : undefined}
                      style={
                        !autoRunDraft.enabled ? { opacity: 0.4 } : undefined
                      }
                      extra={
                        <span style={{ color: 'var(--adm-color-weak)' }}>
                          {autoRunDraft.end_time}
                        </span>
                      }
                    />
                  )}
                </Picker>

                {autoRunConfig?.updated_at && (
                  <Form.Header>
                    {t('admin.scheduleLastSaved', {
                      date: formatDate(autoRunConfig.updated_at),
                    })}
                  </Form.Header>
                )}
              </Form>

              <div style={{ padding: '12px' }}>
                <Button
                  block
                  color="primary"
                  loading={autoRunSaving}
                  disabled={autoRunDraft.days_of_week.length === 0}
                  onClick={saveAutoRunConfig}
                >
                  {t('admin.scheduleSave')}
                </Button>
              </div>
            </div>
          )}
        </Tabs.Tab>
      </Tabs>

      {/* Full-page results modal */}
      <Popup
        visible={isResultsOpen}
        position="bottom"
        bodyStyle={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        destroyOnClose
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {resultsLoading ? (
            <div style={{ padding: '16px' }}>
              <Skeleton.Paragraph lineCount={5} animated />
            </div>
          ) : viewingResult ? (
            <RunResultsPanel
              result={viewingResult}
              stopMap={allStopMap}
              t={t}
            />
          ) : null}
        </div>
      </Popup>
    </Layout>
  );
}
