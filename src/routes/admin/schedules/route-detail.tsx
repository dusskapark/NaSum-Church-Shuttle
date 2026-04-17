import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  Form,
  Input,
  List,
  Popup,
  Skeleton,
  Switch,
  Tag,
  Toast,
} from 'antd-mobile';
import { DeleteOutline, EditSOutline, RedoOutline } from 'antd-mobile-icons';
import { useParams } from '@/lib/router';
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
    restoreStop: 'Restore',
    restoreStopSuccess: 'Stop restored.',
    restoreStopError: 'Failed to restore stop.',
    saveStopSuccess: 'Stop saved.',
    saveStopError: 'Failed to save stop.',
    changeAdded: 'Added',
    changeUpdated: 'Updated',
    changeRemoved: 'Removed',
    syncErrorLabel: 'Sync error',
    searchStopsPlaceholder: 'Search stops',
    addStopButton: 'Add stop',
    addStopTitle: 'New stop',
    addStopSuccess: 'Stop added.',
    addStopError: 'Failed to add stop.',
    addDialogTitle: 'Add stop',
    searchCandidatePlaceholder: 'Search existing stops',
    searchNoResult: 'No matching stop found.',
    alreadyInRoute: 'Already in route',
    addSelected: 'Add selected',
    addNewTitle: 'Add new by Place ID',
    placeNameLabel: 'Stop name',
    addDialogCancel: 'Cancel',
    reorderStopError: 'Failed to reorder stop.',
    googlePlaceRequired: 'Google Place ID is required.',
    searchFailed: 'Search failed.',
    placeLookupFailed: 'Failed to fetch place.',
    duplicateStop: 'This stop is already in the route.',
    placeLookupButton: 'Fetch',
    placeLookupSuccess: 'Place fetched.',
    displayNameEditableLabel: 'Display name',
    stopIdEditableLabel: 'Stop ID',
    isTerminalEditableLabel: 'Terminal',
    readOnlyPlaceLabel: 'Fetched place',
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
    restoreStop: '복원',
    restoreStopSuccess: '정류장이 복원되었습니다.',
    restoreStopError: '정류장 복원에 실패했습니다.',
    saveStopSuccess: '저장되었습니다.',
    saveStopError: '저장에 실패했습니다.',
    changeAdded: '추가',
    changeUpdated: '변경',
    changeRemoved: '제거',
    syncErrorLabel: '동기화 오류',
    searchStopsPlaceholder: '정류장 검색',
    addStopButton: '정류장 추가',
    addStopTitle: '새 정류장',
    addStopSuccess: '정류장이 추가되었습니다.',
    addStopError: '정류장 추가에 실패했습니다.',
    addDialogTitle: '정류장 추가',
    searchCandidatePlaceholder: '기존 정류장 검색',
    searchNoResult: '검색 결과가 없습니다.',
    alreadyInRoute: '이미 추가됨',
    addSelected: '선택 추가',
    addNewTitle: 'Place ID로 신규 추가',
    placeNameLabel: '정류장 이름',
    addDialogCancel: '취소',
    reorderStopError: '정류장 순서 변경에 실패했습니다.',
    googlePlaceRequired: 'Google Place ID를 입력하세요.',
    searchFailed: '검색에 실패했습니다.',
    placeLookupFailed: 'Place 조회에 실패했습니다.',
    duplicateStop: '이미 추가된 정류장입니다.',
    placeLookupButton: '조회',
    placeLookupSuccess: 'Place를 불러왔습니다.',
    displayNameEditableLabel: '표시 이름',
    stopIdEditableLabel: '정류장 ID',
    isTerminalEditableLabel: '종점',
    readOnlyPlaceLabel: '조회된 정류장',
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

interface StopCandidateItem {
  google_place_id: string;
  name: string;
  display_name: string | null;
  stop_id: string | null;
  is_terminal: boolean;
  formatted_address: string | null;
  lat: number;
  lng: number;
  place_types: string[];
  notes: string | null;
  already_in_route: boolean;
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
  const [stopSearch, setStopSearch] = useState('');
  const [editingStop, setEditingStop] = useState<StopSnapshotItem | null>(null);
  const [addingStop, setAddingStop] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [debouncedCandidateQuery, setDebouncedCandidateQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] =
    useState<StopCandidateItem | null>(null);
  const [addStopMode, setAddStopMode] = useState<'search' | 'new'>('search');
  const [lookupPlaceId, setLookupPlaceId] = useState('');
  const [lookupResult, setLookupResult] = useState<StopCandidateItem | null>(null);
  const [lookupErrorMessage, setLookupErrorMessage] = useState<string | null>(null);
  const [newStopDisplayName, setNewStopDisplayName] = useState('');
  const [newStopStopId, setNewStopStopId] = useState('');
  const [newStopIsTerminal, setNewStopIsTerminal] = useState(false);
  const [draggingSequence, setDraggingSequence] = useState<number | null>(null);
  const [dropTargetSequence, setDropTargetSequence] = useState<number | null>(
    null,
  );

  const scheduleQueryKey = useMemo(
    () => ['admin', 'schedules', scheduleId] as const,
    [scheduleId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedCandidateQuery(candidateQuery);
    }, 250);
    return () => clearTimeout(timeout);
  }, [candidateQuery]);

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

  const {
    data: candidates = [],
    isLoading: loadingCandidates,
    isError: isCandidateSearchError,
  } = useQuery({
    queryKey: [
      ...scheduleQueryKey,
      'route',
      routeId,
      'stop-candidates',
      debouncedCandidateQuery,
    ],
    queryFn: async () => {
      const data = await fetchApi<{ items: StopCandidateItem[] }>(
        `/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/stops/candidates?q=${encodeURIComponent(debouncedCandidateQuery.trim())}`,
      );
      return data.items;
    },
    enabled: addingStop && !!scheduleId && !!routeId,
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

  const restoreStopMutation = useMutation({
    mutationFn: (sequence: number) =>
      mutateApi<void>(
        `/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/stops/${sequence}`,
        {
          method: 'PATCH',
          body: { restore: true },
        },
      ),
    onSuccess: () => {
      Toast.show({ content: t.restoreStopSuccess, icon: 'success' });
      invalidateScheduleRoute();
    },
    onError: () => {
      Toast.show({ content: t.restoreStopError, icon: 'fail' });
    },
  });

  const moveStopMutation = useMutation({
    mutationFn: (params: { sequence: number; moveToSequence: number }) =>
      mutateApi<void>(
        `/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/stops/${params.sequence}`,
        {
          method: 'PATCH',
          body: { move_to_sequence: params.moveToSequence },
        },
      ),
    onSuccess: () => {
      invalidateScheduleRoute();
    },
    onError: () => {
      Toast.show({ content: t.reorderStopError, icon: 'fail' });
    },
  });

  const addStopMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mutateApi<void>(
        `/api/v1/admin/schedules/${scheduleId}/routes/${routeId}/stops`,
        {
          method: 'POST',
          body,
        },
      ),
    onSuccess: () => {
      Toast.show({ content: t.addStopSuccess, icon: 'success' });
      setAddingStop(false);
      setSelectedCandidate(null);
      setLookupPlaceId('');
      setLookupResult(null);
      setLookupErrorMessage(null);
      setNewStopDisplayName('');
      setNewStopStopId('');
      setNewStopIsTerminal(false);
      invalidateScheduleRoute();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('409')) {
        Toast.show({ content: t.duplicateStop, icon: 'fail' });
        return;
      }
      Toast.show({ content: t.addStopError, icon: 'fail' });
    },
  });

  const handleSaveStop = useCallback(
    (values: StopEditValues) => {
      if (!editingStop || !scheduleId || !routeId) return;
      const body: Record<string, unknown> = {
        notes: values.notes.trim() || null,
        is_pickup_enabled: values.isPickupEnabled,
        display_name: values.displayName?.trim() || null,
        is_terminal: values.isTerminal,
        google_place_id: values.googlePlaceId.trim() || null,
        stop_id: values.stopId.trim() || null,
      };

      const trimmedPickupTime = values.pickupTime.trim();
      if (trimmedPickupTime.length > 0) {
        body.pickup_time = trimmedPickupTime;
      }

      saveStopMutation.mutate({
        sequence: editingStop.sequence,
        body,
      });
    },
    [editingStop, scheduleId, routeId, saveStopMutation],
  );

  const filteredStops = useMemo(() => {
    const keyword = stopSearch.trim().toLowerCase();
    if (!keyword) return scheduleRoute?.stops_snapshot ?? [];
    return (scheduleRoute?.stops_snapshot ?? []).filter((stop) =>
      [
        stop.place_display_name,
        stop.place_name,
        stop.google_place_id,
        stop.stop_id,
        stop.pickup_time,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword)),
    );
  }, [scheduleRoute?.stops_snapshot, stopSearch]);

  const handleAddCandidate = useCallback(() => {
    if (!selectedCandidate || selectedCandidate.already_in_route) return;
    addStopMutation.mutate({
      google_place_id: selectedCandidate.google_place_id,
      place_name: selectedCandidate.name,
      display_name: selectedCandidate.display_name,
      formatted_address: selectedCandidate.formatted_address,
      lat: selectedCandidate.lat,
      lng: selectedCandidate.lng,
      place_types: selectedCandidate.place_types,
      place_notes: selectedCandidate.notes,
      is_terminal: selectedCandidate.is_terminal,
      stop_id: selectedCandidate.stop_id,
      is_pickup_enabled: true,
    });
  }, [selectedCandidate, addStopMutation]);

  const placeLookupMutation = useMutation({
    mutationFn: async (googlePlaceId: string) => {
      return fetchApi<StopCandidateItem>(
        `/api/v1/admin/places/lookup/${encodeURIComponent(googlePlaceId)}`,
      );
    },
    onSuccess: (place) => {
      setLookupResult({ ...place, already_in_route: false, notes: null });
      setLookupErrorMessage(null);
      setNewStopDisplayName(place.display_name ?? '');
      setNewStopStopId(place.stop_id ?? '');
      setNewStopIsTerminal(place.is_terminal);
      Toast.show({ content: t.placeLookupSuccess, icon: 'success' });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : t.placeLookupFailed;
      setLookupResult(null);
      setLookupErrorMessage(message);
    },
  });

  const handleLookupPlace = useCallback(() => {
    const placeId = lookupPlaceId.trim();
    if (!placeId) {
      setLookupErrorMessage(t.googlePlaceRequired);
      return;
    }
    placeLookupMutation.mutate(placeId);
  }, [lookupPlaceId, placeLookupMutation, t.googlePlaceRequired]);

  const handleAddLookedUpStop = useCallback(() => {
    if (!lookupResult) return;
    addStopMutation.mutate({
      google_place_id: lookupResult.google_place_id,
      display_name: newStopDisplayName.trim() || null,
      stop_id: newStopStopId.trim() || null,
      is_terminal: newStopIsTerminal,
      is_pickup_enabled: true,
    });
  }, [lookupResult, newStopDisplayName, newStopStopId, newStopIsTerminal, addStopMutation]);

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

          <div style={{ padding: '8px 16px 0', display: 'flex', gap: 8 }}>
            <Input
              value={stopSearch}
              onChange={setStopSearch}
              placeholder={t.searchStopsPlaceholder}
              clearable
            />
            <Button
              size="small"
              color="primary"
              fill="outline"
              onClick={() => {
                setAddingStop(true);
                setAddStopMode('search');
                setCandidateQuery('');
                setDebouncedCandidateQuery('');
                setSelectedCandidate(null);
                setLookupPlaceId('');
                setLookupResult(null);
                setLookupErrorMessage(null);
                setNewStopDisplayName('');
                setNewStopStopId('');
                setNewStopIsTerminal(false);
              }}
            >
              {t.addStopButton}
            </Button>
          </div>

          {filteredStops.length === 0 ? (
            <List header={t.stopsHeader}>
              <List.Item>
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {scheduleRoute.stops_snapshot.length === 0
                    ? t.noStops
                    : t.searchStopsPlaceholder}
                </span>
              </List.Item>
            </List>
          ) : (
            <List header={t.stopsHeader}>
              {filteredStops.map((stop) => {
                const isRemoved = stop.change_type === 'removed';
                const isUpdatedOrAdded =
                  stop.change_type === 'updated' ||
                  stop.change_type === 'added';
                const missingTime =
                  isUpdatedOrAdded &&
                  stop.is_pickup_enabled &&
                  !stop.pickup_time;

                return (
                  <div
                    key={`${stop.google_place_id}-${stop.sequence}`}
                    draggable={!isRemoved}
                    onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                      if (isRemoved) return;
                      setDraggingSequence(stop.sequence);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(stop.sequence));
                    }}
                    onDragEnd={() => {
                      setDraggingSequence(null);
                      setDropTargetSequence(null);
                    }}
                    onDragEnter={() => {
                      if (
                        draggingSequence !== null &&
                        draggingSequence !== stop.sequence
                      ) {
                        setDropTargetSequence(stop.sequence);
                      }
                    }}
                    onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                      if (
                        draggingSequence !== null &&
                        draggingSequence !== stop.sequence
                      ) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={() => {
                      if (
                        draggingSequence !== null &&
                        draggingSequence !== stop.sequence
                      ) {
                        moveStopMutation.mutate({
                          sequence: draggingSequence,
                          moveToSequence: stop.sequence,
                        });
                      }
                      setDraggingSequence(null);
                      setDropTargetSequence(null);
                    }}
                    style={{
                      borderTop:
                        dropTargetSequence === stop.sequence
                          ? '2px solid var(--adm-color-primary)'
                          : undefined,
                    }}
                  >
                    <List.Item
                      style={{ opacity: isRemoved ? 0.5 : 1 }}
                      prefix={
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          {!isRemoved && (
                            <span
                              aria-label="Reorder stop"
                              style={{
                                color: 'var(--app-color-subtle-text)',
                                fontSize: 14,
                                lineHeight: 1,
                                cursor: 'grab',
                                userSelect: 'none',
                              }}
                            >
                              ☰
                            </span>
                          )}
                          <div
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              background: 'var(--app-color-background-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textDecoration: isRemoved
                                ? 'line-through'
                                : undefined,
                            }}
                          >
                            {stop.sequence}
                          </div>
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
                        ) : (
                          <Button
                            size="mini"
                            fill="none"
                            color="primary"
                            loading={restoreStopMutation.isPending}
                            onClick={() => restoreStopMutation.mutate(stop.sequence)}
                          >
                            <RedoOutline style={{ fontSize: 16 }} />
                          </Button>
                        )
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
                        onClick={() => {
                          if (!isRemoved) setEditingStop(stop);
                        }}
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
                  </div>
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

      <Popup
        visible={addingStop}
        onMaskClick={() => setAddingStop(false)}
        position="bottom"
        bodyStyle={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ padding: 16, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <h4 style={{ margin: '0 0 12px' }}>{t.addDialogTitle}</h4>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Button
              size="small"
              fill={addStopMode === 'search' ? 'solid' : 'outline'}
              color="primary"
              onClick={() => setAddStopMode('search')}
            >
              {t.searchCandidatePlaceholder}
            </Button>
            <Button
              size="small"
              fill={addStopMode === 'new' ? 'solid' : 'outline'}
              color="primary"
              onClick={() => setAddStopMode('new')}
            >
              {t.addNewTitle}
            </Button>
          </div>

          {addStopMode === 'search' ? (
            <>
              <Input
                value={candidateQuery}
                onChange={setCandidateQuery}
                placeholder={t.searchCandidatePlaceholder}
                clearable
                style={{ marginBottom: 10 }}
              />
              <List>
                {loadingCandidates ? (
                  <List.Item>
                    <span style={{ color: 'var(--app-color-subtle-text)' }}>…</span>
                  </List.Item>
                ) : isCandidateSearchError ? (
                  <List.Item>
                    <span style={{ color: 'var(--adm-color-danger)' }}>
                      {t.searchFailed}
                    </span>
                  </List.Item>
                ) : candidates.length === 0 ? (
                  <List.Item>
                    <span style={{ color: 'var(--app-color-subtle-text)' }}>
                      {t.searchNoResult}
                    </span>
                  </List.Item>
                ) : (
                  candidates.map((item) => (
                    <List.Item
                      key={item.google_place_id}
                      clickable
                      onClick={() => setSelectedCandidate(item)}
                      extra={
                        item.already_in_route ? (
                          <Tag color="warning" fill="outline">
                            {t.alreadyInRoute}
                          </Tag>
                        ) : selectedCandidate?.google_place_id === item.google_place_id ? (
                          <Tag color="primary" fill="outline">
                            ✓
                          </Tag>
                        ) : null
                      }
                      description={item.formatted_address ?? undefined}
                    >
                      {item.display_name ?? item.name}
                    </List.Item>
                  ))
                )}
              </List>

              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <Button
                  block
                  color="primary"
                  fill="outline"
                  disabled={!selectedCandidate || selectedCandidate.already_in_route}
                  loading={addStopMutation.isPending}
                  onClick={handleAddCandidate}
                >
                  {t.addSelected}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Form layout="horizontal" style={{ '--prefix-width': '7em' } as never}>
                <Form.Item label="Google Place ID">
                  <Input value={lookupPlaceId} onChange={setLookupPlaceId} />
                </Form.Item>
              </Form>
              <Button
                block
                color="primary"
                fill="outline"
                loading={placeLookupMutation.isPending}
                onClick={handleLookupPlace}
              >
                {t.placeLookupButton}
              </Button>

              {lookupErrorMessage && (
                <div style={{ marginTop: 8, color: 'var(--adm-color-danger)' }}>
                  {lookupErrorMessage}
                </div>
              )}

              {lookupResult && (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px' }}>{t.readOnlyPlaceLabel}</h4>
                  <List>
                    <List.Item description={lookupResult.formatted_address ?? undefined}>
                      {lookupResult.name}
                    </List.Item>
                    <List.Item description={lookupResult.google_place_id}>Google Place ID</List.Item>
                    <List.Item>{`lat: ${lookupResult.lat}, lng: ${lookupResult.lng}`}</List.Item>
                  </List>

                  <Form layout="horizontal" style={{ '--prefix-width': '8em' } as never}>
                    <Form.Item label={t.displayNameEditableLabel}>
                      <Input value={newStopDisplayName} onChange={setNewStopDisplayName} />
                    </Form.Item>
                    <Form.Item label={t.stopIdEditableLabel}>
                      <Input value={newStopStopId} onChange={setNewStopStopId} />
                    </Form.Item>
                    <Form.Item label={t.isTerminalEditableLabel} childElementPosition="right">
                      <Switch checked={newStopIsTerminal} onChange={setNewStopIsTerminal} />
                    </Form.Item>
                  </Form>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button block fill="outline" onClick={() => setAddingStop(false)}>
              {t.addDialogCancel}
            </Button>
            <Button
              block
              color="primary"
              loading={addStopMutation.isPending}
              disabled={addStopMode === 'new' && !lookupResult}
              onClick={addStopMode === 'search' ? handleAddCandidate : handleAddLookedUpStop}
            >
              {addStopMode === 'search' ? t.addSelected : t.addStopButton}
            </Button>
          </div>
        </div>
      </Popup>
    </Layout>
  );
}
