import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  Dropdown,
  List,
  Popup,
  Skeleton,
  Tag,
  Toast,
} from 'antd-mobile';
import type { DropdownRef } from 'antd-mobile';
import {
  DownOutline,
  DownlandOutline,
  RedoOutline,
  CheckOutline,
  EditSOutline,
} from 'antd-mobile-icons';
import QRCode from 'qrcode';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@/lib/router';
import Layout from '../../components/Layout';
import StopEditPopup, {
  type StopEditValues,
  type PlaceLookupResult,
} from '../../components/StopEditPopup';
import { useContainer } from '../../hooks/useContainer';
import { useAppSettings } from '../../lib/app-settings';
import { formatDateUtc } from '../../lib/date-format';
import {
  getApiBaseUrl,
  getAbsoluteApiBaseUrl,
  buildLiffPermalink,
} from '../../constants/appConfigs';
import { authedFetch } from '../../lib/api';
import { fetchApi, mutateApi } from '../../lib/queries';
import type {
  AdminRouteListItem as AdminRoute,
  AdminLiveRoute as LiveRoute,
  AdminLiveStop as LiveStop,
  AdminScheduleSummary as ScheduleSummary,
} from '@app-types/admin';

// ────────────────────────────────────────────────────────────────────────────
import { getLiff } from '../../lib/liff';

// ── QR URL builder moved to appConfigs.ts ────────────────────────────────────

// ── QR canvas ────────────────────────────────────────────────────────────────

function QrCanvas({ text, size = 200 }: { text: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, text, { width: size, margin: 2 });
  }, [text, size]);
  return <canvas ref={ref} style={{ display: 'block' }} />;
}

async function copyText(text: string): Promise<void> {
  console.log('[Copy] Attempting to copy:', `${text.substring(0, 100)}...`);
  console.log('[Copy] Text length:', text.length);
  console.log('[Copy] Clipboard available:', !!navigator.clipboard);
  console.log('[Copy] Secure context:', window.isSecureContext);

  // Modern clipboard API with verification
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);

      // Verify copy by reading back
      const readText = await navigator.clipboard.readText();
      if (readText === text) {
        console.log('[Copy] Clipboard API success - verified');
        Toast.show({ content: 'Copied to clipboard', icon: 'success' });
      } else {
        console.log(
          '[Copy] Clipboard API failed verification - trying fallback',
        );
        fallbackCopyText(text);
      }
    } catch (err) {
      console.error('[Copy] Clipboard API failed:', err);
      fallbackCopyText(text);
    }
  } else {
    console.log('[Copy] Using fallback method');
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text: string): void {
  console.log('[Copy] Attempting fallback copy method');

  try {
    // Try execCommand with textarea
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const result = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (result) {
      console.log('[Copy] Fallback execCommand success');
      Toast.show({ content: 'Copied to clipboard', icon: 'success' });
      return;
    }

    throw new Error('execCommand returned false');
  } catch (err) {
    console.error('[Copy] All copy methods failed:', err);
    Toast.show({
      content: 'Copy failed. Please try again.',
      icon: 'fail',
      duration: 3000,
    });
  }
}

async function downloadFile(fileUrl: string, filename: string): Promise<void> {
  const liff = await getLiff();
  if (liff) {
    liff.openWindow({ url: fileUrl, external: true });
    Toast.show({ content: 'Opened download in browser', icon: 'success' });
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = fileUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  Toast.show({ content: 'Downloaded', icon: 'success' });
}

async function downloadQr(text: string, filename: string): Promise<void> {
  try {
    // Generate QR as base64 PNG on the client (no server-side qrcode dep needed)
    const dataUrl = await QRCode.toDataURL(text, {
      width: 512,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
      type: 'image/png',
    });
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    // Upload to server → get a short-lived HTTPS download URL
    const res = await authedFetch(
      `${getApiBaseUrl()}/api/v1/admin/download-tokens/blob`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, mimeType: 'image/png', filename }),
      },
    );
    if (!res.ok) throw new Error(`Token creation failed: ${res.status}`);
    const { filename: responseFilename, downloadUrl } = (await res.json()) as {
      filename: string;
      downloadUrl: string;
    };

    const fileUrl = `${getAbsoluteApiBaseUrl()}${downloadUrl}`;
    await downloadFile(fileUrl, responseFilename ?? filename);
  } catch (err) {
    console.error('[Download] QR download failed:', err);
    Toast.show({
      content: `Download failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      icon: 'fail',
      duration: 3000,
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function syncTagColor(
  status: string,
): 'default' | 'success' | 'warning' | 'danger' {
  if (status === 'synced') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'syncing') return 'warning';
  return 'default';
}

async function downloadScheduleMarkdown(
  scheduleId: string,
  scheduleName: string,
): Promise<void> {
  const md = {
    esc(value: string): string {
      return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
    },
    yn(value: boolean): string {
      return value ? 'Yes' : 'No';
    },
  };

  const scheduleRes = await authedFetch(
    `${getApiBaseUrl()}/api/v1/admin/schedules/${scheduleId}`,
  );
  if (!scheduleRes.ok) {
    throw new Error(`Schedule fetch failed: ${scheduleRes.status}`);
  }
  const schedule = (await scheduleRes.json()) as {
    name: string;
    routes: Array<{
      route_code: string;
      display_name: string | null;
      route_name: string | null;
      google_maps_url: string | null;
      stops_snapshot: Array<{
        sequence: number;
        place_name: string;
        place_display_name: string | null;
        pickup_time: string | null;
        is_pickup_enabled: boolean;
        stop_id: string | null;
        is_terminal: boolean;
        change_type: string;
      }>;
    }>;
  };

  const lines: string[] = [];
  lines.push(`# Shuttle Schedule - ${md.esc(schedule.name)}`);
  lines.push('');
  for (const route of schedule.routes) {
    const routeTitle = route.display_name ?? route.route_name ?? route.route_code;
    lines.push(`## ${md.esc(routeTitle)} (${md.esc(route.route_code)})`);
    lines.push(
      `Google Maps URL: ${route.google_maps_url ? route.google_maps_url : '-'}`,
    );
    lines.push('');
    lines.push(
      '| Seq | Stop | Pickup Time | Pickup Enabled | Stop ID | Terminal | Change |',
    );
    lines.push('| ---: | --- | --- | :---: | :---: | :---: | :---: |');
    const orderedStops = [...route.stops_snapshot].sort(
      (a, b) => a.sequence - b.sequence,
    );
    for (const stop of orderedStops) {
      const stopName = stop.place_display_name ?? stop.place_name;
      const pickup = stop.pickup_time ?? '-';
      const stopId = stop.stop_id ?? '-';
      lines.push(
        `| ${stop.sequence} | ${md.esc(stopName)} | ${md.esc(pickup)} | ${md.yn(stop.is_pickup_enabled)} | ${md.esc(stopId)} | ${md.yn(stop.is_terminal)} | ${md.esc(stop.change_type)} |`,
      );
    }
    lines.push('');
  }
  const markdown = `${lines.join('\n')}\n`;

  const bytes = new TextEncoder().encode(markdown);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary);

  const tokenRes = await authedFetch(
    `${getApiBaseUrl()}/api/v1/admin/download-tokens/blob`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: base64,
        mimeType: 'text/markdown; charset=utf-8',
        filename: `shuttle-${scheduleName}.md`,
      }),
    },
  );
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    throw new Error(`Token creation failed: ${tokenRes.status} ${body}`);
  }

  const { filename, downloadUrl } = (await tokenRes.json()) as {
    filename: string;
    downloadUrl: string;
  };
  const outputFilename = filename ?? `shuttle-${scheduleName}.md`;

  const fileUrl = `${getAbsoluteApiBaseUrl()}${downloadUrl}`;
  await downloadFile(fileUrl, outputFilename);
}

// ── Strings ──────────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    title: 'Routes & Stops',
    newSchedule: 'New Schedule',
    noRoutes: 'No routes yet.',
    loadError: 'Failed to load routes.',
    stopCount: (n: number) => `${n} stop${n !== 1 ? 's' : ''}`,
    incompleteStops: (n: number) => `${n} missing time`,
    inactive: 'Inactive',
    latestTag: 'latest',
    draftInProgress: 'Draft in progress',
    continueEditing: 'Continue Editing →',
    createScheduleError: 'Failed to create schedule.',
    draftAlreadyExists: 'A draft already exists.',
    downloadError: 'Failed to download.',
    noPublishedSchedule: 'No schedule yet',
    saveSuccess: 'Stop saved.',
    saveError: 'Failed to save stop.',
    restore: 'Restore',
    restoreConfirm: (name: string) =>
      `Restore "${name}" and replace the currently deployed schedule?`,
    restoreSuccess: 'Schedule restored.',
    restoreError: 'Failed to restore schedule.',
    cancel: 'Cancel',
  },
  ko: {
    title: '노선·정류장 관리',
    newSchedule: '새 스케줄 만들기',
    noRoutes: '등록된 노선이 없습니다.',
    loadError: '노선 목록을 불러오지 못했습니다.',
    stopCount: (n: number) => `정류장 ${n}개`,
    incompleteStops: (n: number) => `시간 미입력 ${n}개`,
    inactive: '비활성',
    latestTag: 'latest',
    draftInProgress: 'Draft 진행 중',
    continueEditing: '계속 편집 →',
    createScheduleError: '스케줄 생성에 실패했습니다.',
    draftAlreadyExists: 'Draft가 이미 존재합니다.',
    downloadError: '다운로드에 실패했습니다.',
    noPublishedSchedule: '스케줄 없음',
    saveSuccess: '저장되었습니다.',
    saveError: '저장에 실패했습니다.',
    restore: '복원',
    restoreConfirm: (name: string) =>
      `"${name}" 스케줄을 복원하고 현재 배포 스케줄을 교체할까요?`,
    restoreSuccess: '스케줄이 복원되었습니다.',
    restoreError: '스케줄 복원에 실패했습니다.',
    cancel: '취소',
  },
};

// ── QR Tab Component ──────────────────────────────────────────────────────────

function QrCodePanel({
  routeCode,
}: {
  routeCode: string;
}) {
  const deeplink = buildLiffPermalink('prod', { routeCode });

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          color: 'var(--app-color-subtle-text)',
          fontSize: 13,
          textAlign: 'center',
          marginBottom: 16,
          lineHeight: 1.4,
        }}
      >
        https://liff.line.me/
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <QrCanvas text={deeplink} size={180} />
          <div
            style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 240 }}
          >
            <Button
              size="small"
              fill="outline"
              onClick={() => copyText(deeplink)}
              style={{ flex: 1 }}
            >
              <CheckOutline style={{ marginRight: 4 }} />
              Copy
            </Button>
            <Button
              size="small"
              fill="solid"
              color="primary"
              onClick={() =>
                downloadQr(
                  deeplink,
                  `${routeCode}-qr.png`,
                )
              }
              style={{ flex: 1 }}
            >
              <DownlandOutline style={{ marginRight: 4 }} />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminRoutesListPage() {
  const navigate = useNavigate();
  const { lang } = useAppSettings();
  const t = STRINGS[lang === 'ko' ? 'ko' : 'en'];
  useContainer(t.title);

  const dropdownRef = useRef<DropdownRef>(null);
  const queryClient = useQueryClient();

  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [qrRoute, setQrRoute] = useState<{ code: string; name: string } | null>(
    null,
  );

  // Stop edit
  const [editingStop, setEditingStop] = useState<{
    routeId: string;
    routeStopId: string;
    stopName: string;
    initialValues: StopEditValues;
  } | null>(null);
  const [savingStop, setSavingStop] = useState(false);

  const { data: routesData, isLoading: loading } = useQuery({
    queryKey: ['admin', 'routes-list'],
    queryFn: async () => {
      const [routes, schedules, liveRoutes] = await Promise.all([
        fetchApi<AdminRoute[]>('/api/v1/admin/routes'),
        fetchApi<ScheduleSummary[]>('/api/v1/admin/schedules'),
        fetchApi<LiveRoute[]>('/api/v1/routes').catch(() => [] as LiveRoute[]),
      ]);
      return {
        routes,
        schedules,
        liveRouteMap: new Map(liveRoutes.map((r) => [r.route_code, r.stops])),
      };
    },
    meta: { errorMessage: t.loadError },
  });

  const routes = routesData?.routes ?? [];
  const schedules = routesData?.schedules ?? [];
  const liveRouteMap =
    routesData?.liveRouteMap ?? new Map<string, LiveStop[]>();

  const publishedSchedule =
    schedules.find((s) => s.status === 'published') ?? null;
  const draftSchedule = schedules.find((s) => s.status === 'draft') ?? null;
  const archivedSchedules = schedules.filter((s) => s.status === 'archived');

  const handleOpenEdit = useCallback((routeId: string, stop: LiveStop) => {
    setEditingStop({
      routeId,
      routeStopId: stop.id,
      stopName: stop.place.name,
      initialValues: {
        displayName: stop.place.display_name,
        isTerminal: stop.place.is_terminal,
        pickupTime: stop.pickup_time ?? '',
        notes: stop.notes ?? '',
        isPickupEnabled: stop.is_pickup_enabled,
        googlePlaceId: stop.place.google_place_id,
        stopId: stop.stop_id ?? '',
      },
    });
  }, []);

  const saveStopMutation = useMutation({
    mutationFn: async (values: StopEditValues) => {
      if (!editingStop) throw new Error('No stop being edited');
      const basePath = `/api/v1/admin/routes/${editingStop.routeId}/stops/${editingStop.routeStopId}`;
      await Promise.all([
        mutateApi(basePath, {
          method: 'PATCH',
          body: {
            pickup_time: values.pickupTime || null,
            notes: values.notes.trim() || null,
            is_pickup_enabled: values.isPickupEnabled,
          },
        }),
        mutateApi(`${basePath}/place`, {
          method: 'PATCH',
          body: {
            google_place_id: values.googlePlaceId.trim() || null,
            display_name: values.displayName?.trim() || null,
            is_terminal: values.isTerminal,
            stop_id: values.stopId.trim() || null,
          },
        }),
      ]);
    },
    onSuccess: () => {
      Toast.show({ content: t.saveSuccess, icon: 'success' });
      setEditingStop(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'routes-list'] });
    },
    onError: () => {
      Toast.show({ content: t.saveError, icon: 'fail' });
    },
  });

  const handleSaveStop = useCallback(
    async (values: StopEditValues) => {
      if (!editingStop) return;
      setSavingStop(true);
      try {
        await saveStopMutation.mutateAsync(values);
      } finally {
        setSavingStop(false);
      }
    },
    [editingStop, saveStopMutation],
  );

  const handleFetchPlace = useCallback(
    async (googlePlaceId: string): Promise<PlaceLookupResult | null> => {
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/places/lookup/${encodeURIComponent(googlePlaceId)}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        name: string;
        display_name: string | null;
        stop_id: string | null;
        is_terminal: boolean;
      };
      // Update the popup header to reflect the new place name
      setEditingStop((prev) =>
        prev ? { ...prev, stopName: data.name } : null,
      );
      return {
        name: data.name,
        displayName: data.display_name,
        stopId: data.stop_id,
        isTerminal: data.is_terminal,
      };
    },
    [],
  );

  const toggleRoute = (routeCode: string) => {
    setExpandedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(routeCode)) next.delete(routeCode);
      else next.add(routeCode);
      return next;
    });
  };

  const handleNewSchedule = useCallback(async () => {
    setCreatingSchedule(true);
    try {
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/schedules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (res.status === 409) {
        const body = (await res.json()) as { draft?: { id: string } };
        if (body.draft?.id) {
          navigate(`/admin/schedules/${body.draft.id}`);
        } else {
          Toast.show({ content: t.draftAlreadyExists, icon: 'fail' });
        }
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { id } = (await res.json()) as { id: string };
      navigate(`/admin/schedules/${id}`);
    } catch {
      Toast.show({ content: t.createScheduleError, icon: 'fail' });
    } finally {
      setCreatingSchedule(false);
    }
  }, [t, navigate]);

  const handleDownload = useCallback(
    async (scheduleId: string, scheduleName: string) => {
      setDownloadingId(scheduleId);
      try {
        await downloadScheduleMarkdown(scheduleId, scheduleName);
        dropdownRef.current?.close();
      } catch (err) {
        console.error('[Download] handleDownload failed:', err);
        Toast.show({ content: t.downloadError, icon: 'fail' });
      } finally {
        setDownloadingId(null);
      }
    },
    [t],
  );

  const handleRestore = useCallback(
    (targetSchedule: ScheduleSummary) => {
      Dialog.confirm({
        content: t.restoreConfirm(targetSchedule.name),
        confirmText: t.restore,
        cancelText: t.cancel,
        onConfirm: async () => {
          try {
            await mutateApi(`/api/v1/admin/schedules/${targetSchedule.id}/restore`, {
              method: 'POST',
            });
            Toast.show({ content: t.restoreSuccess, icon: 'success' });
            queryClient.invalidateQueries({ queryKey: ['admin', 'routes-list'] });
          } catch {
            Toast.show({ content: t.restoreError, icon: 'fail' });
          }
        },
      });
    },
    [queryClient, t],
  );

  return (
    <Layout showTabBar={false}>
      {/* Version dropdown + New Schedule */}
      <div
        style={{
          padding: '8px 16px 0',
          display: 'flex',
          gap: 8,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {publishedSchedule || archivedSchedules.length > 0 ? (
          <Dropdown
            ref={dropdownRef}
            arrowIcon={<DownOutline />}
            closeOnMaskClick
            closeOnClickAway
          >
            <Dropdown.Item
              key="versions"
              title={
                publishedSchedule?.name ?? archivedSchedules[0]?.name ?? '—'
              }
            >
              <List>
                {publishedSchedule && (
                  <List.Item
                    key={publishedSchedule.id}
                    extra={
                      <Button
                        size="mini"
                        fill="outline"
                        loading={downloadingId === publishedSchedule.id}
                        onClick={() =>
                          handleDownload(
                            publishedSchedule.id,
                            publishedSchedule.name,
                          ).catch(() => {})
                        }
                      >
                        <DownlandOutline />
                      </Button>
                    }
                  >
                    <span style={{ fontWeight: 600 }}>
                      {publishedSchedule.name}
                    </span>
                    <Tag
                      color="success"
                      fill="solid"
                      style={{ marginLeft: 6, verticalAlign: 'middle' }}
                    >
                      {t.latestTag}
                    </Tag>
                  </List.Item>
                )}
                {archivedSchedules.map((s) => (
                  <List.Item
                    key={s.id}
                    extra={
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button
                          size="mini"
                          fill="outline"
                          loading={downloadingId === s.id}
                          onClick={() =>
                            handleDownload(s.id, s.name).catch(() => {})
                          }
                        >
                          <DownlandOutline />
                        </Button>
                        <Button
                          size="mini"
                          fill="outline"
                          color="primary"
                          onClick={() => handleRestore(s)}
                        >
                          <RedoOutline />
                        </Button>
                      </div>
                    }
                  >
                    {s.name}
                    <span
                      style={{
                        color: 'var(--app-color-subtle-text)',
                        marginLeft: 6,
                      }}
                    >
                      {s.published_at
                        ? formatDateUtc(s.published_at)
                        : ''}
                    </span>
                  </List.Item>
                ))}
              </List>
            </Dropdown.Item>
          </Dropdown>
        ) : (
          <span
            style={{ color: 'var(--app-color-subtle-text)', padding: '8px 0' }}
          >
            {t.noPublishedSchedule}
          </span>
        )}

        <Button
          size="small"
          color="primary"
          loading={creatingSchedule}
          onClick={() => {
            handleNewSchedule().catch(() => {});
          }}
        >
          {t.newSchedule}
        </Button>
      </div>

      {/* Draft banner */}
      {draftSchedule && (
        <div
          style={{
            margin: '8px 16px 0',
            padding: '10px 14px',
            background: '#e6f4ff',
            border: '1px solid #91caff',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ color: '#0958d9' }}>
            ✏️ {t.draftInProgress}: <strong>{draftSchedule.name}</strong>
          </span>
          <Button
            size="mini"
            color="primary"
            onClick={() => navigate(`/admin/schedules/${draftSchedule.id}`)}
          >
            {t.continueEditing}
          </Button>
        </div>
      )}

      {/* Route list */}
      {loading ? (
        <div style={{ padding: '12px 16px' }}>
          <Skeleton.Paragraph lineCount={4} animated />
        </div>
      ) : routes.length === 0 ? (
        <div style={{ padding: '16px', color: 'var(--app-color-subtle-text)' }}>
          {t.noRoutes}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {routes.map((route) => {
            const isExpanded = expandedRoutes.has(route.route_code);
            const stops = liveRouteMap.get(route.route_code) ?? [];
            const routeTitle =
              route.display_name ?? route.name ?? route.route_code;

            return (
              <div key={route.id} style={{ marginBottom: 1 }}>
                {/* Route header */}
                <div
                  style={{
                    padding: '10px 16px',
                    background: 'var(--adm-color-background)',
                    borderBottom: '1px solid var(--app-color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => toggleRoute(route.route_code)}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span
                        style={{
                          color: 'var(--app-color-subtle-text)',
                          flexShrink: 0,
                        }}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span style={{ fontWeight: 700 }}>{routeTitle}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--app-color-subtle-text)' }}>
                        {route.line} · {route.service}
                      </span>
                      <span style={{ color: 'var(--app-color-subtle-text)' }}>
                        {t.stopCount(route.stop_count)}
                      </span>
                      <Tag
                        color={syncTagColor(route.sync_status)}
                        fill="outline"
                      >
                        {route.sync_status}
                      </Tag>
                      {route.incomplete_stop_count > 0 && (
                        <Tag color="warning" fill="outline">
                          ⚠️ {t.incompleteStops(route.incomplete_stop_count)}
                        </Tag>
                      )}
                      {!route.active && (
                        <Tag color="default" fill="outline">
                          {t.inactive}
                        </Tag>
                      )}
                    </div>
                  </div>
                  <Button
                    size="mini"
                    fill="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrRoute({ code: route.route_code, name: routeTitle });
                    }}
                  >
                    QR
                  </Button>
                </div>

                {/* Stops */}
                {isExpanded && (
                  <List style={{ '--border-top': 'none' }}>
                    {stops.map((stop) => (
                      <List.Item
                        key={stop.id}
                        extra={
                          <Button
                            size="mini"
                            fill="none"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(route.id, stop);
                            }}
                          >
                            <EditSOutline style={{ fontSize: 16 }} />
                          </Button>
                        }
                        prefix={
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {stop.sequence}
                          </div>
                        }
                        description={
                          stop.pickup_time ? (
                            <span
                              style={{ color: 'var(--app-color-subtle-text)' }}
                            >
                              {stop.pickup_time}
                            </span>
                          ) : null
                        }
                      >
                        {stop.place.display_name ?? stop.place.name}
                      </List.Item>
                    ))}
                  </List>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Popup
        visible={qrRoute !== null}
        onMaskClick={() => setQrRoute(null)}
        bodyStyle={{ padding: '16px 16px 24px', borderRadius: '16px 16px 0 0' }}
      >
        {qrRoute && (
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                textAlign: 'center',
                marginBottom: 4,
              }}
            >
              {qrRoute.name}
            </div>
            <div
              style={{
                color: 'var(--app-color-subtle-text)',
                fontSize: 12,
                textAlign: 'center',
                marginBottom: 20,
              }}
            >
              {qrRoute.code}
            </div>
            <QrCodePanel routeCode={qrRoute.code} />
            <Button
              block
              size="middle"
              style={{ marginTop: 20 }}
              onClick={() => setQrRoute(null)}
            >
              Close
            </Button>
          </div>
        )}
      </Popup>

      <StopEditPopup
        visible={editingStop !== null}
        stopName={editingStop?.stopName ?? ''}
        initialValues={
          editingStop?.initialValues ?? {
            displayName: null,
            isTerminal: false,
            pickupTime: '',
            notes: '',
            isPickupEnabled: true,
            googlePlaceId: '',
            stopId: '',
          }
        }
        saving={savingStop}
        onSave={(values) => {
          handleSaveStop(values).catch(() => {});
        }}
        onFetchPlace={handleFetchPlace}
        onClose={() => setEditingStop(null)}
        lang={lang}
      />
    </Layout>
  );
}
