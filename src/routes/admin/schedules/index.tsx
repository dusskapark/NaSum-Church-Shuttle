import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  Form,
  Input,
  List,
  Popup,
  Skeleton,
  Tag,
  Toast,
} from 'antd-mobile';
import {
  AddOutline,
  DeleteOutline,
  RedoOutline,
  UploadOutline,
} from 'antd-mobile-icons';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../../components/Layout';
import { useContainer } from '../../../hooks/useContainer';
import { useAppSettings } from '../../../lib/app-settings';
import { getApiBaseUrl } from '../../../constants/appConfigs';
import { authedFetch } from '../../../lib/api';
import { fetchApi, mutateApi } from '../../../lib/queries';
import type { AdminSchedule as Schedule } from '@app-types/admin';

const STRINGS = {
  en: {
    back: 'Routes',
    loadError: 'Failed to load schedule.',
    syncAll: 'Sync All',
    syncing: 'Syncing…',
    syncAllDone: (ok: number, total: number) => `Synced ${ok}/${total} routes`,
    syncRouteError: 'Sync failed.',
    publishButton: 'Save & Deploy',
    publishing: 'Publishing…',
    publishConfirm: 'Deploy this schedule to live service?',
    publishConfirmOk: 'Deploy',
    publishCancel: 'Cancel',
    publishSuccess: 'Published!',
    publishError: 'Failed to publish.',
    publishValidationError: 'Some stops are missing pickup times.',
    deleteButton: 'Discard',
    deleteConfirm: 'Discard this draft? This cannot be undone.',
    deleteConfirmOk: 'Discard',
    deleteCancel: 'Cancel',
    deleteSuccess: 'Draft discarded.',
    deleteError: 'Failed to discard draft.',
    incompleteStops: (n: number) =>
      `${n} stop${n !== 1 ? 's' : ''} missing pickup time`,
    stopCount: (n: number) => `${n} stop${n !== 1 ? 's' : ''}`,
    noRoutes: 'No routes in this schedule.',
    addRoute: '+ Add Route',
    addRouteTitle: 'Add New Route',
    addRouteSave: 'Add',
    addRouteCancel: 'Cancel',
    addRouteSuccess: 'Route added. Sync it to load stops.',
    addRouteError: 'Failed to add route.',
    addRouteValidation:
      'Route code, Line, Service, and Google Maps URL are required.',
    incompleteTag: '⚠️',
  },
  ko: {
    back: '노선 목록',
    loadError: '스케줄을 불러오지 못했습니다.',
    syncAll: 'Sync All',
    syncing: '동기화 중…',
    syncAllDone: (ok: number, total: number) =>
      `${ok}/${total} 노선 동기화 완료`,
    syncRouteError: '동기화에 실패했습니다.',
    publishButton: '저장 & 배포',
    publishing: '배포 중…',
    publishConfirm: '이 스케줄을 서비스에 배포할까요?',
    publishConfirmOk: '배포',
    publishCancel: '취소',
    publishSuccess: '배포되었습니다!',
    publishError: '배포에 실패했습니다.',
    publishValidationError: '탑승 시간이 입력되지 않은 정류장이 있습니다.',
    deleteButton: '폐기',
    deleteConfirm: '이 Draft를 폐기할까요? 되돌릴 수 없습니다.',
    deleteConfirmOk: '폐기',
    deleteCancel: '취소',
    deleteSuccess: 'Draft가 폐기되었습니다.',
    deleteError: 'Draft 폐기에 실패했습니다.',
    incompleteStops: (n: number) => `탑승 시간 미입력 ${n}개`,
    stopCount: (n: number) => `정류장 ${n}개`,
    noRoutes: '스케줄에 노선이 없습니다.',
    addRoute: '+ 새 노선 추가',
    addRouteTitle: '새 노선 추가',
    addRouteSave: '추가',
    addRouteCancel: '취소',
    addRouteSuccess: '노선이 추가되었습니다. Sync하여 정류장을 불러오세요.',
    addRouteError: '노선 추가에 실패했습니다.',
    addRouteValidation:
      '노선 코드, Line, Service, Google Maps URL은 필수입니다.',
    incompleteTag: '⚠️',
  },
};

interface ToolbarButtonProps {
  icon: ReactNode;
  label: string;
  color?: 'primary' | 'danger' | 'default';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function ToolbarButton({
  icon,
  label,
  color = 'default',
  loading = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  const colorMap: Record<string, string> = {
    primary: 'var(--adm-color-primary)',
    danger: 'var(--adm-color-danger)',
    default: 'var(--adm-color-text)',
  };
  const iconColor = disabled ? 'var(--adm-color-weak)' : colorMap[color];

  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 10px',
        border: 'none',
        background: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        color: iconColor,
        fontSize: 10,
        minWidth: 52,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1, display: 'flex' }}>
        {loading ? '…' : icon}
      </span>
      <span style={{ whiteSpace: 'nowrap', color: iconColor }}>{label}</span>
    </button>
  );
}

export default function AdminScheduleDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const { lang } = useAppSettings();
  const t = STRINGS[lang === 'ko' ? 'ko' : 'en'];

  const queryClient = useQueryClient();
  const [syncingAll, setSyncingAll] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Add route sheet
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [addRouteCode, setAddRouteCode] = useState('');
  const [addLine, setAddLine] = useState('');
  const [addService, setAddService] = useState('');
  const [addMapsUrl, setAddMapsUrl] = useState('');

  const { data: schedule = null, isLoading: loading } = useQuery({
    queryKey: ['admin', 'schedules', scheduleId],
    queryFn: () => fetchApi<Schedule>(`/api/v1/admin/schedules/${scheduleId}`),
    enabled: !!scheduleId,
  });

  useContainer(schedule ? `Schedule: ${schedule.name}` : '...');

  const handleSyncAll = useCallback(async () => {
    if (!scheduleId || !schedule) return;
    setSyncingAll(true);
    try {
      const res = await authedFetch(
        `${getApiBaseUrl()}/api/v1/admin/schedules/${scheduleId}/sync`,
        { method: 'POST' },
      );
      const result = (await res.json()) as {
        synced: number;
        errors: Array<{ route_id: string; error: string }>;
      };
      Toast.show({
        content: t.syncAllDone(result.synced, schedule.routes.length),
        icon: result.errors.length === 0 ? 'success' : undefined,
        duration: 3000,
      });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'schedules', scheduleId],
      });
    } catch {
      Toast.show({ content: t.syncRouteError, icon: 'fail' });
    } finally {
      setSyncingAll(false);
    }
  }, [scheduleId, schedule, t, queryClient]);

  const handlePublish = useCallback(() => {
    if (!scheduleId) return;
    Dialog.confirm({
      content: t.publishConfirm,
      confirmText: t.publishConfirmOk,
      cancelText: t.publishCancel,
      onConfirm: async () => {
        setPublishing(true);
        try {
          const res = await authedFetch(
            `${getApiBaseUrl()}/api/v1/admin/schedules/${scheduleId}/publish`,
            { method: 'POST' },
          );
          if (!res.ok) {
            const body = (await res.json()) as {
              error?: string;
              details?: Array<{ route_code: string; sequences: number[] }>;
            };
            if (body.details) {
              const detail = body.details
                .map((r) => `${r.route_code}: #${r.sequences.join(', #')}`)
                .join(' / ');
              Toast.show({
                content: `${t.publishValidationError} (${detail})`,
                icon: 'fail',
                duration: 8000,
              });
            } else {
              throw new Error(body.error ?? `HTTP ${res.status}`);
            }
            return;
          }
          Toast.show({ content: t.publishSuccess, icon: 'success' });
          navigate('/admin/routes');
        } catch {
          Toast.show({ content: t.publishError, icon: 'fail' });
        } finally {
          setPublishing(false);
        }
      },
    });
  }, [scheduleId, t, navigate]);

  const deleteDraftMutation = useMutation({
    mutationFn: () =>
      mutateApi<void>(`/api/v1/admin/schedules/${scheduleId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      Toast.show({ content: t.deleteSuccess, icon: 'success' });
      navigate('/admin/routes');
    },
    onError: () => {
      Toast.show({ content: t.deleteError, icon: 'fail' });
    },
  });

  const handleDeleteDraft = useCallback(() => {
    if (!scheduleId) return;
    Dialog.confirm({
      content: t.deleteConfirm,
      confirmText: t.deleteConfirmOk,
      cancelText: t.deleteCancel,
      onConfirm: () => {
        deleteDraftMutation.mutate();
      },
    });
  }, [scheduleId, t, deleteDraftMutation]);

  const addRouteMutation = useMutation({
    mutationFn: (body: {
      route_code: string;
      line: string;
      service: string;
      google_maps_url: string;
    }) =>
      mutateApi<void>(`/api/v1/admin/schedules/${scheduleId}/routes`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      Toast.show({ content: t.addRouteSuccess, icon: 'success' });
      setShowAddRoute(false);
      setAddRouteCode('');
      setAddLine('');
      setAddService('');
      setAddMapsUrl('');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'schedules', scheduleId],
      });
    },
    onError: () => {
      Toast.show({ content: t.addRouteError, icon: 'fail' });
    },
  });

  const addingRoute = addRouteMutation.isPending;

  const handleAddRoute = useCallback(() => {
    if (
      !addRouteCode.trim() ||
      !addLine.trim() ||
      !addService.trim() ||
      !addMapsUrl.trim()
    ) {
      Toast.show({ content: t.addRouteValidation, icon: 'fail' });
      return;
    }
    addRouteMutation.mutate({
      route_code: addRouteCode.trim(),
      line: addLine.trim(),
      service: addService.trim(),
      google_maps_url: addMapsUrl.trim(),
    });
  }, [addRouteCode, addLine, addService, addMapsUrl, t, addRouteMutation]);

  const incompleteCount =
    schedule?.routes.reduce((total, sr) => {
      return (
        total +
        sr.stops_snapshot.filter(
          (s) =>
            (s.change_type === 'updated' || s.change_type === 'added') &&
            s.is_pickup_enabled &&
            !s.pickup_time,
        ).length
      );
    }, 0) ?? 0;

  const isDraft = schedule?.status === 'draft';
  return (
    <Layout showTabBar={false}>
      {loading ? (
        <div style={{ padding: '12px 16px' }}>
          <Skeleton.Paragraph lineCount={4} animated />
        </div>
      ) : !schedule ? (
        <div style={{ padding: 16, color: 'var(--app-color-subtle-text)' }}>
          {t.loadError}
        </div>
      ) : (
        <>
          {/* Top action bar */}
          {isDraft && (
            <div
              style={{
                padding: '8px 16px',
                display: 'flex',
                gap: 4,
                justifyContent: 'flex-end',
                alignItems: 'center',
                borderBottom: '1px solid var(--adm-color-border)',
              }}
            >
              <ToolbarButton
                icon={<DeleteOutline />}
                label={t.deleteButton}
                color="danger"
                onClick={handleDeleteDraft}
              />
              <ToolbarButton
                icon={<AddOutline />}
                label={t.addRoute}
                onClick={() => setShowAddRoute(true)}
              />
              <ToolbarButton
                icon={<RedoOutline />}
                label={syncingAll ? t.syncing : t.syncAll}
                loading={syncingAll}
                onClick={() => {
                  handleSyncAll().catch(() => {});
                }}
              />
              <ToolbarButton
                icon={<UploadOutline />}
                label={publishing ? t.publishing : t.publishButton}
                color="primary"
                loading={publishing}
                disabled={incompleteCount > 0}
                onClick={handlePublish}
              />
            </div>
          )}

          {/* Incomplete stop warning */}
          {incompleteCount > 0 && (
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
          )}

          {/* Route list */}
          {schedule.routes.length === 0 ? (
            <div
              style={{ padding: '16px', color: 'var(--app-color-subtle-text)' }}
            >
              {t.noRoutes}
            </div>
          ) : (
            <List>
              {schedule.routes.map((sr) => {
                const routeTitle =
                  sr.display_name ?? sr.route_name ?? sr.route_code;
                const routeIncompleteCount = sr.stops_snapshot.filter(
                  (s) =>
                    (s.change_type === 'updated' ||
                      s.change_type === 'added') &&
                    s.is_pickup_enabled &&
                    !s.pickup_time,
                ).length;
                const isRouteSyncing = syncingAll;

                return (
                  <List.Item
                    key={sr.route_id}
                    clickable={!syncingAll}
                    onClick={
                      syncingAll
                        ? undefined
                        : () =>
                            navigate(
                              `/admin/schedules/${scheduleId}/routes/${sr.route_id}`,
                            )
                    }
                    style={{ opacity: syncingAll ? 0.6 : 1 }}
                    description={t.stopCount(sr.stops_snapshot.length)}
                    extra={
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          alignItems: 'center',
                        }}
                      >
                        <Tag
                          color={
                            isRouteSyncing
                              ? 'warning'
                              : sr.sync_status === 'synced'
                                ? 'success'
                                : sr.sync_status === 'error'
                                  ? 'danger'
                                  : sr.sync_status === 'syncing'
                                    ? 'warning'
                                    : 'default'
                          }
                          fill="outline"
                        >
                          {isRouteSyncing ? t.syncing : sr.sync_status}
                        </Tag>
                        {!isRouteSyncing && routeIncompleteCount > 0 && (
                          <Tag color="warning" fill="outline">
                            {t.incompleteTag}
                          </Tag>
                        )}
                      </div>
                    }
                  >
                    {routeTitle}
                  </List.Item>
                );
              })}
            </List>
          )}
        </>
      )}

      {/* Add route popup */}
      <Popup
        visible={showAddRoute}
        onMaskClick={() => setShowAddRoute(false)}
        position="bottom"
        bodyStyle={{
          borderRadius: '16px 16px 0 0',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '16px 16px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            {t.addRouteTitle}
          </div>
          <Form layout="vertical">
            <Form.Item label="Route code *">
              <Input
                placeholder="Route code *"
                value={addRouteCode}
                onChange={setAddRouteCode}
              />
            </Form.Item>
            <Form.Item label="Line *">
              <Input
                placeholder="Line *"
                value={addLine}
                onChange={setAddLine}
              />
            </Form.Item>
            <Form.Item label="Service *">
              <Input
                placeholder="Service *"
                value={addService}
                onChange={setAddService}
              />
            </Form.Item>
            <Form.Item label="Google Maps URL *">
              <Input
                placeholder="Google Maps URL *"
                value={addMapsUrl}
                onChange={setAddMapsUrl}
              />
            </Form.Item>
          </Form>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <Button
              block
              fill="outline"
              onClick={() => setShowAddRoute(false)}
              disabled={addingRoute}
            >
              {t.addRouteCancel}
            </Button>
            <Button
              block
              color="primary"
              loading={addingRoute}
              onClick={() => {
                handleAddRoute();
              }}
            >
              {t.addRouteSave}
            </Button>
          </div>
        </div>
      </Popup>
    </Layout>
  );
}
