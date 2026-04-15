import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  Form,
  Input,
  List,
  Skeleton,
  Switch,
  Tag,
  Toast,
} from 'antd-mobile';
import { DeleteOutline, EditSOutline } from 'antd-mobile-icons';
import { useParams } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { useContainer } from '../../../hooks/useContainer';
import { useAppSettings } from '../../../lib/app-settings';
import { getApiBaseUrl } from '../../../constants/appConfigs';
import { authedFetch } from '../../../lib/api';
import { fetchApi, mutateApi } from '../../../lib/queries';
import type {
  AdminScheduleStopSnapshot as StopSnapshotItem,
  AdminScheduleWithRouteDetails as Schedule,
} from '@app-types/admin';
import StopEditPopup, {
  type StopEditValues,
} from '../../../components/StopEditPopup';

// ── Strings ───────────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    back: 'Schedule',
    loadError: 'Failed to load route.',
    routeNotFound: 'Route not found in this schedule.',
    syncButton: 'Sync',
    syncing: 'Syncing…',
    syncSuccess: 'Route synced.',
    syncError: 'Sync failed.',
    saveButton: 'Save',
    saveSuccess: 'Saved.',
    saveError: 'Failed to save.',
    routeCodeLabel: 'Route code',
    syncStatusLabel: 'Sync status',
    displayNameLabel: 'Display name',
    mapsUrlLabel: 'Google Maps URL',
    activeLabel: 'Active',
    stopsHeader: 'Stops',
    noStops: 'No stops yet. Sync this route to load stops.',
    incompleteStops: (n: number) =>
      `${n} stop${n !== 1 ? 's' : ''} missing pickup time`,
    missingPickupTime: 'No pickup time',
    editStop: 'Edit',
    deleteStop: 'Delete',
    deleteStopConfirm: 'Remove this stop from the schedule?',
    deleteStopConfirmOk: 'Remove',
    deleteStopCancel: 'Cancel',
    deleteStopSuccess: 'Stop removed.',
    deleteStopError: 'Failed to remove stop.',
    saveStopSuccess: 'Stop saved.',
    saveStopError: 'Failed to save stop.',
    changeAdded: 'Added',
    changeUpdated: 'Updated',
    changeRemoved: 'Removed',
    syncErrorLabel: 'Sync error',
  },
  ko: {
    back: '스케줄',
    loadError: '노선 정보를 불러오지 못했습니다.',
    routeNotFound: '스케줄에서 노선을 찾을 수 없습니다.',
    syncButton: 'Sync',
    syncing: '동기화 중…',
    syncSuccess: '노선이 동기화되었습니다.',
    syncError: '동기화에 실패했습니다.',
    saveButton: '저장',
    saveSuccess: '저장되었습니다.',
    saveError: '저장에 실패했습니다.',
    routeCodeLabel: '노선 코드',
    syncStatusLabel: '동기화 상태',
    displayNameLabel: '표시 이름',
    mapsUrlLabel: 'Google Maps URL',
    activeLabel: '활성',
    stopsHeader: '정류장 목록',
    noStops: '정류장이 없습니다. 노선을 Sync하여 정류장을 불러오세요.',
    incompleteStops: (n: number) => `탑승 시간 미입력 ${n}개`,
    missingPickupTime: '시간 미입력',
    editStop: '편집',
    deleteStop: '삭제',
    deleteStopConfirm: '이 정류장을 스케줄에서 제거할까요?',
    deleteStopConfirmOk: '제거',
    deleteStopCancel: '취소',
    deleteStopSuccess: '정류장이 제거되었습니다.',
    deleteStopError: '정류장 제거에 실패했습니다.',
    saveStopSuccess: '저장되었습니다.',
    saveStopError: '저장에 실패했습니다.',
    changeAdded: '추가',
    changeUpdated: '변경',
    changeRemoved: '제거',
    syncErrorLabel: '동기화 오류',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function changeTypeBadge(
  change_type: StopSnapshotItem['change_type'],
  t: (typeof STRINGS)['en'],
): React.ReactNode | null {
  if (change_type === 'added')
    return (
      <Tag color="success" fill="outline">
        {t.changeAdded}
      </Tag>
    );
  if (change_type === 'updated')
    return (
      <Tag color="warning" fill="outline">
        {t.changeUpdated}
      </Tag>
    );
  if (change_type === 'removed')
    return (
      <Tag color="danger" fill="outline">
        {t.changeRemoved}
      </Tag>
    );
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminScheduleRouteDetailPage() {
  const { scheduleId, routeId } = useParams<{
    scheduleId: string;
    routeId: string;
  }>();
  const { lang } = useAppSettings();
  const t = STRINGS[lang === 'ko' ? 'ko' : 'en'];

  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Route form fields
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editMapsUrl, setEditMapsUrl] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Stop editing
  const [editingStop, setEditingStop] = useState<StopSnapshotItem | null>(null);

  const scheduleQueryKey = useMemo(
    () => ['admin', 'schedules', scheduleId] as const,
    [scheduleId],
  );

  const { data: scheduleRoute = null, isLoading: loading } = useQuery({
    queryKey: [...scheduleQueryKey, 'route', routeId],
    queryFn: async () => {
      const data = await fetchApi<Schedule>(
        `/api/v1/admin/schedules/${scheduleId}`,
      );
      const found = data.routes.find((r) => r.route_id === routeId) ?? null;
      if (found) {
        setEditDisplayName(found.display_name ?? '');
        setEditMapsUrl(found.google_maps_url ?? '');
        setEditActive(found.active ?? true);
      }
      return found;
    },
    enabled: !!scheduleId && !!routeId,
  });

  useContainer(
    scheduleRoute
      ? (scheduleRoute.display_name ??
          scheduleRoute.route_name ??
          scheduleRoute.route_code)
      : '...',
  );

  const invalidateScheduleRoute = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [...scheduleQueryKey, 'route', routeId],
    });
    queryClient.invalidateQueries({ queryKey: scheduleQueryKey, exact: true });
  }, [queryClient, routeId, scheduleQueryKey]);

  const handleSyncRoute = useCallback(async () => {
    if (!scheduleId || !routeId || !scheduleRoute) return;
    setSyncing(true);
    try {
      // Auto-save if the Google Maps URL has been edited before syncing
      const urlChanged =
        editMapsUrl.trim() !== (scheduleRoute.google_maps_url ?? '');
      if (urlChanged) {
        await mutateApi<void>(
          `/api/v1/admin/routes/${scheduleRoute.route_id}`,
          {
            method: 'PATCH',
            body: {
              display_name: editDisplayName.trim() || null,
              google_maps_url: editMapsUrl.trim() || null,
              active: editActive,
            },
          },
        );
      }

      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/sync`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      Toast.show({ content: t.syncSuccess, icon: 'success' });
      invalidateScheduleRoute();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.syncError;
      Toast.show({ content: msg, icon: 'fail', duration: 4000 });
    } finally {
      setSyncing(false);
    }
  }, [
    scheduleId,
    routeId,
    scheduleRoute,
    editMapsUrl,
    editDisplayName,
    editActive,
    t,
    invalidateScheduleRoute,
  ]);

  const saveRouteMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mutateApi<void>(`/api/v1/admin/routes/${scheduleRoute!.route_id}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () => {
      Toast.show({ content: t.saveSuccess, icon: 'success' });
      invalidateScheduleRoute();
    },
    onError: () => {
      Toast.show({ content: t.saveError, icon: 'fail' });
    },
  });

  const savingRoute = saveRouteMutation.isPending;

  const handleSaveRoute = useCallback(() => {
    if (!scheduleRoute) return;
    saveRouteMutation.mutate({
      display_name: editDisplayName.trim() || null,
      google_maps_url: editMapsUrl.trim() || null,
      active: editActive,
    });
  }, [
    scheduleRoute,
    editDisplayName,
    editMapsUrl,
    editActive,
    saveRouteMutation,
  ]);

  const deleteStopMutation = useMutation({
    mutationFn: (sequence: number) =>
      mutateApi<void>(
        `/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/stops/${sequence}`,
        { method: 'DELETE' },
      ),
    onSuccess: () => {
      Toast.show({ content: t.deleteStopSuccess, icon: 'success' });
      invalidateScheduleRoute();
    },
    onError: () => {
      Toast.show({ content: t.deleteStopError, icon: 'fail' });
    },
  });

  const handleDeleteStop = useCallback(
    (stop: StopSnapshotItem) => {
      if (!scheduleId || !routeId) return;
      Dialog.confirm({
        content: t.deleteStopConfirm,
        confirmText: t.deleteStopConfirmOk,
        cancelText: t.deleteStopCancel,
        onConfirm: () => {
          deleteStopMutation.mutate(stop.sequence);
        },
      });
    },
    [scheduleId, routeId, t, deleteStopMutation],
  );

  const saveStopMutation = useMutation({
    mutationFn: (params: { sequence: number; body: Record<string, unknown> }) =>
      mutateApi<void>(
        `/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/stops/${params.sequence}`,
        { method: 'PATCH', body: params.body },
      ),
    onSuccess: () => {
      Toast.show({ content: t.saveStopSuccess, icon: 'success' });
      setEditingStop(null);
      invalidateScheduleRoute();
    },
    onError: () => {
      Toast.show({ content: t.saveStopError, icon: 'fail' });
    },
  });

  const savingStop = saveStopMutation.isPending;

  const handleSaveStop = useCallback(
    (values: StopEditValues) => {
      if (!editingStop || !scheduleId || !routeId) return;
      saveStopMutation.mutate({
        sequence: editingStop.sequence,
        body: {
          pickup_time: values.pickupTime || null,
          notes: values.notes.trim() || null,
          is_pickup_enabled: values.isPickupEnabled,
          display_name: values.displayName?.trim() || null,
          is_terminal: values.isTerminal,
          google_place_id: values.googlePlaceId.trim() || null,
          stop_id: values.stopId.trim() || null,
        },
      });
    },
    [editingStop, scheduleId, routeId, saveStopMutation],
  );

  return (
    <Layout showTabBar={false}>
      {loading ? (
        <div style={{ padding: '12px 16px' }}>
          <Skeleton.Paragraph lineCount={6} animated />
        </div>
      ) : !scheduleRoute ? (
        <div style={{ padding: 16, color: 'var(--app-color-subtle-text)' }}>
          {t.routeNotFound}
        </div>
      ) : (
        <>
          {/* Route info edit section */}
          <Form
            layout="horizontal"
            style={{ '--prefix-width': '9em' } as never}
          >
            <Form.Item label={t.routeCodeLabel}>
              <span style={{ fontSize: 14, fontFamily: 'monospace' }}>
                {scheduleRoute.route_code}
              </span>
            </Form.Item>

            <Form.Item label={t.displayNameLabel}>
              <Input
                value={editDisplayName}
                onChange={setEditDisplayName}
                placeholder={
                  scheduleRoute.route_name ?? scheduleRoute.route_code
                }
              />
            </Form.Item>

            <Form.Item label={t.mapsUrlLabel}>
              <Input
                value={editMapsUrl}
                onChange={setEditMapsUrl}
                placeholder="https://maps.google.com/..."
              />
            </Form.Item>

            <Form.Item label={t.syncStatusLabel}>
              <Tag
                color={
                  scheduleRoute.sync_status === 'synced'
                    ? 'success'
                    : scheduleRoute.sync_status === 'error'
                      ? 'danger'
                      : scheduleRoute.sync_status === 'syncing'
                        ? 'warning'
                        : 'default'
                }
                fill="outline"
              >
                {scheduleRoute.sync_status}
              </Tag>
              {scheduleRoute.sync_error && (
                <span style={{ marginLeft: 8, color: '#cf1322', fontSize: 12 }}>
                  {scheduleRoute.sync_error}
                </span>
              )}
            </Form.Item>

            <Form.Item label={t.activeLabel} childElementPosition="right">
              <Switch checked={editActive} onChange={setEditActive} />
            </Form.Item>
          </Form>

          <div
            style={{ padding: '0 16px', display: 'flex', gap: 8, marginTop: 8 }}
          >
            <Button
              block
              size="small"
              color="primary"
              fill="outline"
              loading={savingRoute}
              onClick={() => {
                handleSaveRoute();
              }}
            >
              {t.saveButton}
            </Button>
            <Button
              block
              size="small"
              color="primary"
              loading={syncing}
              onClick={() => {
                handleSyncRoute().catch(() => {});
              }}
            >
              {syncing ? t.syncing : t.syncButton}
            </Button>
          </div>

          {/* Stops list */}
          {(() => {
            const incompleteCount = scheduleRoute.stops_snapshot.filter(
              (s) =>
                (s.change_type === 'updated' || s.change_type === 'added') &&
                s.is_pickup_enabled &&
                !s.pickup_time,
            ).length;
            return incompleteCount > 0 ? (
              <div
                style={{
                  margin: '0 16px 8px',
                  padding: '8px 12px',
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  borderRadius: 8,
                  color: '#ad6800',
                }}
              >
                ⚠️ {t.incompleteStops(incompleteCount)}
              </div>
            ) : null;
          })()}

          {scheduleRoute.stops_snapshot.length === 0 ? (
            <List header={t.stopsHeader}>
              <List.Item>
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {t.noStops}
                </span>
              </List.Item>
            </List>
          ) : (
            <List header={t.stopsHeader}>
              {scheduleRoute.stops_snapshot.map((stop) => {
                const isRemoved = stop.change_type === 'removed';
                const isUpdatedOrAdded =
                  stop.change_type === 'updated' ||
                  stop.change_type === 'added';
                const missingTime =
                  isUpdatedOrAdded &&
                  stop.is_pickup_enabled &&
                  !stop.pickup_time;

                return (
                  <List.Item
                    key={`${stop.google_place_id}-${stop.sequence}`}
                    style={{ opacity: isRemoved ? 0.5 : 1 }}
                    prefix={
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'var(--app-color-background-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          textDecoration: isRemoved
                            ? 'line-through'
                            : undefined,
                        }}
                      >
                        {stop.sequence}
                      </div>
                    }
                    extra={
                      !isRemoved ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button
                            size="mini"
                            fill="none"
                            color="danger"
                            onClick={() => handleDeleteStop(stop)}
                          >
                            <DeleteOutline style={{ fontSize: 16 }} />
                          </Button>
                          <Button
                            size="mini"
                            fill="none"
                            onClick={() => setEditingStop(stop)}
                          >
                            <EditSOutline style={{ fontSize: 16 }} />
                          </Button>
                        </div>
                      ) : null
                    }
                    description={
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          flexWrap: 'wrap',
                          marginTop: 2,
                        }}
                      >
                        {changeTypeBadge(stop.change_type, t)}
                        {stop.is_terminal && (
                          <Tag color="primary" fill="outline">
                            Terminal
                          </Tag>
                        )}
                        {stop.stop_id && (
                          <span
                            style={{
                              fontFamily: 'monospace',
                              color: 'var(--app-color-subtle-text)',
                            }}
                          >
                            #{stop.stop_id}
                          </span>
                        )}
                        {stop.pickup_time ? (
                          <span
                            style={{
                              textDecoration: isRemoved
                                ? 'line-through'
                                : undefined,
                            }}
                          >
                            {stop.pickup_time}
                          </span>
                        ) : missingTime ? (
                          <Tag color="warning" fill="outline">
                            ⚠️ {t.missingPickupTime}
                          </Tag>
                        ) : null}
                        {stop.notes && <span>· {stop.notes}</span>}
                      </div>
                    }
                  >
                    <span
                      style={{
                        textDecoration: isRemoved ? 'line-through' : undefined,
                        color: isRemoved
                          ? 'var(--app-color-subtle-text)'
                          : undefined,
                      }}
                    >
                      {stop.place_display_name ?? stop.place_name}
                    </span>
                    {stop.place_display_name && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: 'var(--app-color-subtle-text)',
                        }}
                      >
                        ({stop.place_name})
                      </span>
                    )}
                  </List.Item>
                );
              })}
            </List>
          )}
        </>
      )}

      <StopEditPopup
        visible={editingStop !== null}
        stopName={editingStop?.place_name ?? ''}
        initialValues={
          editingStop
            ? {
                displayName: editingStop.place_display_name,
                isTerminal: editingStop.is_terminal,
                pickupTime: editingStop.pickup_time ?? '',
                notes: editingStop.notes ?? '',
                isPickupEnabled: editingStop.is_pickup_enabled,
                googlePlaceId: editingStop.google_place_id,
                stopId: editingStop.stop_id ?? '',
              }
            : {
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
          handleSaveStop(values);
        }}
        onClose={() => setEditingStop(null)}
        lang={lang}
      />
    </Layout>
  );
}
