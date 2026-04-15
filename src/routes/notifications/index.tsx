import { useCallback, useMemo, useState } from 'react';
import { Button, InfiniteScroll, List, Toast } from 'antd-mobile';
import { BellOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { useContainer } from '../../hooks/useContainer';
import { useAppSettings } from '../../lib/app-settings';
import { useTranslation } from '../../lib/useTranslation';
import { fetchApi, mutateApi } from '../../lib/queries';
import type { AppNotification } from '@app-types/core';
import { DEV_NOTIFICATIONS } from './_devData';

const PAGE_SIZE = 5;
const INITIAL_DATA =
  process.env.NODE_ENV === 'development' ? DEV_NOTIFICATIONS : [];

function formatRelativeTime(isoString: string, lang: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (lang === 'ko') {
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  }
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const { lang } = useAppSettings();
  const t = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useContainer(t('notifications.title'));

  const { data: allNotifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => fetchApi<AppNotification[]>('/api/v1/notifications'),
    placeholderData: INITIAL_DATA.length > 0 ? INITIAL_DATA : undefined,
  });

  const allData =
    allNotifications && allNotifications.length > 0
      ? allNotifications
      : INITIAL_DATA;

  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const displayed = useMemo(
    () => allData.slice(0, pageSize),
    [allData, pageSize],
  );
  const hasMore = pageSize < allData.length;

  const loadMore = useCallback(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    setPageSize((prev) => prev + PAGE_SIZE);
  }, []);

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      mutateApi(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const prev = queryClient.getQueryData<AppNotification[]>([
        'notifications',
      ]);
      queryClient.setQueryData<AppNotification[]>(['notifications'], (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['notifications'], context.prev);
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      mutateApi('/api/v1/notifications/read-all', { method: 'PATCH' }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const prev = queryClient.getQueryData<AppNotification[]>([
        'notifications',
      ]);
      queryClient.setQueryData<AppNotification[]>(['notifications'], (old) =>
        (old ?? []).map((n) => ({ ...n, is_read: true })),
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['notifications'], context.prev);
      }
      Toast.show({ content: t('common.serverError'), icon: 'fail' });
    },
  });

  const handleItemClick = useCallback(
    (n: AppNotification) => {
      if (!n.is_read) markReadMutation.mutate(n.id);
      if (n.route_code && n.user_route_stop_id) {
        navigate(`/?route=${n.route_code}&stop=${n.user_route_stop_id}`);
      }
    },
    [markReadMutation, navigate],
  );

  const unreadCount = displayed.filter((n) => !n.is_read).length;

  const getTitle = (n: AppNotification) =>
    lang === 'ko' ? n.title_ko : n.title_en;
  const getBody = (n: AppNotification) =>
    lang === 'ko' ? n.body_ko : n.body_en;

  return (
    <Layout>
      {/* Sticky header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 10px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--adm-color-background)',
          borderBottom: '1px solid var(--adm-color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--app-color-title)',
            }}
          >
            {t('notifications.title')}
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                background: 'var(--adm-color-primary)',
                color: '#fff',
                borderRadius: 99,
                fontSize: 11,
                padding: '1px 7px',
                lineHeight: '18px',
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            size="mini"
            fill="none"
            onClick={() => markAllReadMutation.mutate()}
            style={{ color: 'var(--adm-color-primary)', fontSize: 13 }}
          >
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {displayed.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingTop: 80,
            color: 'var(--app-color-subtle-text)',
          }}
        >
          <BellOutline style={{ fontSize: 40 }} />
          <div style={{ fontSize: 15 }}>
            {t('notifications.noNotifications')}
          </div>
        </div>
      ) : (
        <>
          <List>
            {displayed.map((n) => (
              <List.Item
                key={n.id}
                clickable={!!(n.route_code && n.user_route_stop_id)}
                onClick={() => handleItemClick(n)}
                style={{
                  borderLeft: n.is_read
                    ? 'none'
                    : '3px solid var(--adm-color-primary)',
                }}
                description={
                  <span
                    style={{
                      color: 'var(--app-color-subtle-text)',
                      fontSize: 13,
                    }}
                  >
                    {getBody(n)}
                  </span>
                }
                extra={
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--app-color-subtle-text)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatRelativeTime(n.created_at, lang)}
                  </span>
                }
              >
                <span
                  style={{
                    fontWeight: n.is_read ? 400 : 600,
                    color: n.is_read
                      ? 'var(--app-color-subtle-text)'
                      : 'var(--app-color-title)',
                    fontSize: 15,
                  }}
                >
                  {getTitle(n)}
                </span>
              </List.Item>
            ))}
          </List>
          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
        </>
      )}
    </Layout>
  );
}
