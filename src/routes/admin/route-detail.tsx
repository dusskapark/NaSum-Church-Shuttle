import { useState } from 'react';
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
import { useParams } from '@/lib/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { useContainer } from '../../hooks/useContainer';
import { useAppSettings } from '../../lib/app-settings';
import { getApiBaseUrl } from '../../constants/appConfigs';
import { authedFetch } from '../../lib/api';
import { fetchApi, mutateApi } from '../../lib/queries';
import { formatDateTimeUtc } from '../../lib/date-format';
import type { AdminRouteDetail as AdminRoute } from '@app-types/admin';
import StopEditSheet, { type AdminStop } from './stop-edit-sheet';

const STRINGS = {
  en: {
    back: 'Routes',
    loadError: 'Failed to load route.',
    syncButton: 'Sync from Google Maps',
    syncing: 'Syncing…',
    syncSuccess: (added: number, updated: number, removed: number) =>
      `${added} added, ${updated} updated, ${removed} removed`,
    syncWarning: (
      added: number,
      updated: number,
      removed: number,
      unresolved: number,
    ) =>
      `${added} added, ${updated} updated, ${removed} removed · ${unresolved} stop(s) could not be resolved`,
    syncError: 'Sync failed.',
    noMapsUrl: 'No Google Maps URL set.',
    saveButton: 'Save',
    saveSuccess: 'Saved.',
    saveError: 'Failed to save.',
    stopLoadError: 'Failed to load stops.',
    stopsHeader: 'Stops',
    noStops: 'No stops yet. Set a Google Maps URL and sync.',
    incompleteStops: (n: number) =>
      `${n} stop${n !== 1 ? 's' : ''} missing pickup time`,
    missingPickupTime: 'No pickup time',
    displayNameLabel: 'Display name',
    mapsUrlLabel: 'Google Maps URL',
    activeLabel: 'Active',
    lastSynced: 'Last synced',
    syncStatus: 'Sync status',
    syncErrorLabel: 'Sync error',
    editStop: 'Edit',
    deleteStop: 'Remove',
    deleteConfirm: 'Remove this stop from the route?',
    deleteConfirmOk: 'Remove',
    deleteCancel: 'Cancel',
    deleteSuccess: 'Stop removed.',
    deleteError: 'Failed to remove stop.',
    terminalBadge: 'Terminal',
    disabledBadge: 'Disabled',
  },
  ko: {
    back: '노선 목록',
    loadError: '노선 정보를 불러오지 못했습니다.',
    syncButton: 'Google Maps 동기화',
    syncing: '동기화 중…',
    syncSuccess: (added: number, updated: number, removed: number) =>
      `${added}개 추가, ${updated}개 수정, ${removed}개 제거`,
    syncWarning: (
      added: number,
      updated: number,
      removed: number,
      unresolved: number,
    ) =>
      `${added}개 추가, ${updated}개 수정, ${removed}개 제거 · ${unresolved}개 정류장 미확인`,
    syncError: '동기화에 실패했습니다.',
    noMapsUrl: 'Google Maps URL이 설정되지 않았습니다.',
    saveButton: '저장',
    saveSuccess: '저장되었습니다.',
    saveError: '저장에 실패했습니다.',
    stopLoadError: '정류장 목록을 불러오지 못했습니다.',
    stopsHeader: '정류장 목록',
    noStops: '정류장이 없습니다. Google Maps URL을 설정하고 동기화하세요.',
    incompleteStops: (n: number) => `탑승 시간이 없는 정류장 ${n}개`,
    missingPickupTime: '시간 미입력',
    displayNameLabel: '표시 이름',
    mapsUrlLabel: 'Google Maps URL',
    activeLabel: '활성',
    lastSynced: '마지막 동기화',
    syncStatus: '동기화 상태',
    syncErrorLabel: '동기화 오류',
    editStop: '수정',
    deleteStop: '제거',
    deleteConfirm: '이 정류장을 노선에서 제거할까요?',
    deleteConfirmOk: '제거',
    deleteCancel: '취소',
    deleteSuccess: '정류장이 제거되었습니다.',
    deleteError: '정류장 제거에 실패했습니다.',
    terminalBadge: '터미널',
    disabledBadge: '비활성',
  },
};

interface RouteEditDraft {
  key: string;
  displayName: string;
  mapsUrl: string;
  active: boolean;
}

export default function AdminRouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const { lang } = useAppSettings();
  const t = STRINGS[lang === 'ko' ? 'ko' : 'en'];
  const queryClient = useQueryClient();

  const [routeDraft, setRouteDraft] = useState<RouteEditDraft | null>(null);

  // Stop edit sheet
  const [editingStop, setEditingStop] = useState<AdminStop | null>(null);

  const { data: route, isLoading: loadingRoute } = useQuery({
    queryKey: ['admin', 'routes', routeId],
    queryFn: () => fetchApi<AdminRoute>(`/api/v1/admin/routes/${routeId}`),
    enabled: !!routeId,
  });

  const { data: stops = [], isLoading: loadingStops } = useQuery({
    queryKey: ['admin', 'routes', routeId, 'stops'],
    queryFn: () =>
      fetchApi<AdminStop[]>(`/api/v1/admin/routes/${routeId}/stops`),
    enabled: !!routeId,
  });

  const draftKey = routeId ?? '';
  const hasRouteDraft = routeDraft?.key === draftKey;
  const editDisplayName = hasRouteDraft
    ? routeDraft.displayName
    : (route?.display_name ?? '');
  const editMapsUrl = hasRouteDraft
    ? routeDraft.mapsUrl
    : (route?.google_maps_url ?? '');
  const editActive = hasRouteDraft ? routeDraft.active : (route?.active ?? true);

  const updateRouteDraft = (
    patch: Partial<Omit<RouteEditDraft, 'key'>>,
  ) => {
    if (!draftKey) return;
    setRouteDraft((prev) => {
      const sameDraft = prev?.key === draftKey;
      return {
        key: draftKey,
        displayName:
          patch.displayName ??
          (sameDraft ? prev.displayName : (route?.display_name ?? '')),
        mapsUrl:
          patch.mapsUrl ??
          (sameDraft ? prev.mapsUrl : (route?.google_maps_url ?? '')),
        active:
          patch.active ?? (sameDraft ? prev.active : (route?.active ?? true)),
      };
    });
  };

  useContainer(route?.display_name ?? route?.route_code ?? '...');

  const saveRouteMutation = useMutation({
    mutationFn: () =>
      mutateApi<AdminRoute>(`/api/v1/admin/routes/${routeId}`, {
        method: 'PATCH',
        body: {
          display_name: editDisplayName.trim() || null,
          google_maps_url: editMapsUrl.trim() || null,
          active: editActive,
        },
      }),
    onSuccess: () => {
      Toast.show({ content: t.saveSuccess, icon: 'success' });
      setRouteDraft(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'routes', routeId] });
    },
    onError: () => {
      Toast.show({ content: t.saveError, icon: 'fail' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/routes/${routeId}/sync`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      return (await res.json()) as {
        diff: { added: number; updated: number; removed: number };
        unresolved?: number;
      };
    },
    onSuccess: (result) => {
      const unresolved = result.unresolved ?? 0;
      Toast.show({
        content:
          unresolved > 0
            ? t.syncWarning(
                result.diff.added,
                result.diff.updated,
                result.diff.removed,
                unresolved,
              )
            : t.syncSuccess(
                result.diff.added,
                result.diff.updated,
                result.diff.removed,
              ),
        icon: unresolved > 0 ? undefined : 'success',
        duration: unresolved > 0 ? 5000 : 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'routes', routeId] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'routes', routeId, 'stops'],
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : t.syncError;
      Toast.show({ content: msg, icon: 'fail', duration: 4000 });
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: (stopId: string) =>
      mutateApi<null>(`/api/v1/admin/routes/${routeId}/stops/${stopId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      Toast.show({ content: t.deleteSuccess, icon: 'success' });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'routes', routeId, 'stops'],
      });
    },
    onError: () => {
      Toast.show({ content: t.deleteError, icon: 'fail' });
    },
  });

  const handleSaveRoute = () => {
    if (!routeId) return;
    saveRouteMutation.mutate();
  };

  const handleSync = () => {
    if (!routeId) return;
    if (!editMapsUrl.trim() && !route?.google_maps_url) {
      Toast.show({ content: t.noMapsUrl, icon: 'fail' });
      return;
    }
    syncMutation.mutate();
  };

  const handleDeleteStop = (stop: AdminStop) => {
    Dialog.confirm({
      content: t.deleteConfirm,
      confirmText: t.deleteConfirmOk,
      cancelText: t.deleteCancel,
      onConfirm: () => {
        deleteStopMutation.mutate(stop.route_stop_id);
      },
    });
  };

  return (
    <Layout showTabBar={false}>
      {loadingRoute ? (
        <div style={{ padding: '12px 16px' }}>
          <Skeleton.Paragraph lineCount={4} animated />
        </div>
      ) : route ? (
        <>
          {/* Route info edit section */}
          <List
            header={`${route.route_code} · ${route.line} ${route.service}`}
          />
          <Form layout="horizontal">
            <Form.Item label={t.displayNameLabel}>
              <Input
                value={editDisplayName}
                onChange={(value) => {
                  updateRouteDraft({ displayName: value });
                }}
                placeholder={route.name ?? route.route_code}
              />
            </Form.Item>

            <Form.Item label={t.mapsUrlLabel}>
              <Input
                value={editMapsUrl}
                onChange={(value) => {
                  updateRouteDraft({ mapsUrl: value });
                }}
                placeholder="https://maps.google.com/..."
              />
            </Form.Item>

            <Form.Item label={t.activeLabel} childElementPosition="right">
              <Switch
                checked={editActive}
                onChange={(value) => {
                  updateRouteDraft({ active: value });
                }}
              />
            </Form.Item>
          </Form>

          <div
            style={{
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                block
                size="small"
                color="primary"
                fill="outline"
                loading={saveRouteMutation.isPending}
                onClick={handleSaveRoute}
              >
                {t.saveButton}
              </Button>
              <Button
                block
                size="small"
                color="primary"
                loading={syncMutation.isPending}
                onClick={handleSync}
              >
                {syncMutation.isPending ? t.syncing : t.syncButton}
              </Button>
            </div>

            {route.sync_status && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <Tag
                  color={
                    route.sync_status === 'synced'
                      ? 'success'
                      : route.sync_status === 'error'
                        ? 'danger'
                        : 'default'
                  }
                  fill="outline"
                >
                  {route.sync_status}
                </Tag>
                {route.last_synced_at && (
                  <span style={{ color: 'var(--app-color-subtle-text)' }}>
                    {t.lastSynced}:{' '}
                    {formatDateTimeUtc(route.last_synced_at)}
                  </span>
                )}
              </div>
            )}

            {route.sync_error && (
              <div
                style={{
                  padding: '8px 10px',
                  background: '#fff1f0',
                  border: '1px solid #ffa39e',
                  borderRadius: 8,
                  color: '#cf1322',
                }}
              >
                {t.syncErrorLabel}: {route.sync_error}
              </div>
            )}
          </div>

          {/* Stops list */}
          {(() => {
            const incompleteCount = stops.filter(
              (s) => s.is_pickup_enabled && !s.pickup_time,
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                ⚠️ {t.incompleteStops(incompleteCount)}
              </div>
            ) : null;
          })()}

          {loadingStops ? (
            <div style={{ padding: '0 16px 8px' }}>
              <Skeleton.Paragraph lineCount={3} animated />
            </div>
          ) : stops.length === 0 ? (
            <List header={t.stopsHeader}>
              <List.Item>
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {t.noStops}
                </span>
              </List.Item>
            </List>
          ) : (
            <List header={t.stopsHeader}>
              {stops.map((stop) => (
                <List.Item
                  key={stop.route_stop_id}
                  prefix={
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--app-color-background-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {stop.sequence}
                    </div>
                  }
                  extra={
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button
                        size="mini"
                        fill="outline"
                        onClick={() => setEditingStop(stop)}
                      >
                        {t.editStop}
                      </Button>
                      <Button
                        size="mini"
                        fill="outline"
                        color="danger"
                        onClick={() => handleDeleteStop(stop)}
                      >
                        {t.deleteStop}
                      </Button>
                    </div>
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
                      {stop.pickup_time ? (
                        <span>{stop.pickup_time}</span>
                      ) : stop.is_pickup_enabled ? (
                        <Tag color="warning" fill="outline">
                          {t.missingPickupTime}
                        </Tag>
                      ) : null}
                      {stop.route_stop_notes && (
                        <span>· {stop.route_stop_notes}</span>
                      )}
                      {stop.is_terminal && (
                        <Tag fill="outline">{t.terminalBadge}</Tag>
                      )}
                      {!stop.is_pickup_enabled && (
                        <Tag color="default" fill="outline">
                          {t.disabledBadge}
                        </Tag>
                      )}
                    </div>
                  }
                >
                  {stop.place_display_name ?? stop.place_name}
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
              ))}
            </List>
          )}
        </>
      ) : (
        <div style={{ padding: 16, color: 'var(--app-color-subtle-text)' }}>
          {t.loadError}
        </div>
      )}

      <StopEditSheet
        stop={editingStop}
        routeId={routeId ?? ''}
        visible={editingStop !== null}
        onClose={() => setEditingStop(null)}
        onSaved={() => {
          setEditingStop(null);
          queryClient.invalidateQueries({
            queryKey: ['admin', 'routes', routeId, 'stops'],
          });
        }}
        lang={lang}
      />
    </Layout>
  );
}
