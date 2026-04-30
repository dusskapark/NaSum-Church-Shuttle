import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, List, Skeleton, Tag, Toast } from 'antd-mobile';
import Layout from '../../components/Layout';
import { useContainer } from '../../hooks/useContainer';
import { useTranslation } from '../../lib/useTranslation';
import { fetchApi, mutateApi } from '../../lib/queries';

interface PrivilegedUser {
  user_id: string;
  display_name: string | null;
  picture_url: string | null;
  role: string;
  provider: string;
  provider_uid: string;
}

export default function AdminUsersPage() {
  const t = useTranslation();
  useContainer(t('admin.usersSection'));

  const queryClient = useQueryClient();

  const { data: privUsers = [], isLoading: privUsersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => fetchApi<PrivilegedUser[]>('/api/v1/admin/users'),
  });

  const [assignUserId, setAssignUserId] = useState('');
  const [assignProvider, setAssignProvider] = useState<
    'line' | 'apple' | 'google' | 'email_password'
  >('line');
  const [assignRole, setAssignRole] = useState<'admin' | 'driver'>('driver');

  const assignMutation = useMutation({
    mutationFn: (params: { provider_uid: string; provider: string; role: string }) =>
      mutateApi<void>('/api/v1/admin/users', {
        method: 'POST',
        body: params,
      }),
    onSuccess: () => {
      Toast.show({ content: t('admin.assignRole'), icon: 'success' });
      setAssignUserId('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) =>
      mutateApi<void>(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      Toast.show({ content: t('admin.removeRole'), icon: 'success' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    },
  });

  const handleAssignRole = useCallback(() => {
    if (!assignUserId.trim()) return;
    assignMutation.mutate({
      provider_uid: assignUserId.trim(),
      provider: assignProvider,
      role: assignRole,
    });
  }, [assignUserId, assignProvider, assignRole, assignMutation]);

  const handleRevokeRole = useCallback(
    (userId: string) => {
      revokeMutation.mutate(userId);
    },
    [revokeMutation],
  );

  const assignBusy = assignMutation.isPending;

  return (
    <Layout showTabBar={false}>
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder={t('admin.userIdPlaceholder')}
          value={assignUserId}
          onChange={(e) => setAssignUserId(e.target.value)}
          style={{
            flex: 1,
            minWidth: 160,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--app-color-border)',
            background: 'var(--adm-color-background)',
            color: 'var(--app-color-title)',
          }}
        />
        <select
          value={assignProvider}
          onChange={(e) =>
            setAssignProvider(
              e.target.value as 'line' | 'apple' | 'google' | 'email_password',
            )
          }
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--app-color-border)',
            background: 'var(--adm-color-background)',
            color: 'var(--app-color-title)',
          }}
        >
          <option value="line">LINE</option>
          <option value="apple">Apple</option>
          <option value="google">Google</option>
          <option value="email_password">Email</option>
        </select>
        <select
          value={assignRole}
          onChange={(e) => setAssignRole(e.target.value as 'admin' | 'driver')}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--app-color-border)',
            background: 'var(--adm-color-background)',
            color: 'var(--app-color-title)',
          }}
        >
          <option value="driver">{t('admin.roleDriver')}</option>
          <option value="admin">{t('admin.roleAdmin')}</option>
        </select>
        <Button
          size="small"
          color="primary"
          loading={assignBusy}
          disabled={!assignUserId.trim() || assignBusy}
          onClick={() => {
            handleAssignRole();
          }}
        >
          {t('admin.assignRole')}
        </Button>
      </div>

      {privUsersLoading ? (
        <div style={{ padding: '0 16px 8px' }}>
          <Skeleton.Paragraph lineCount={2} animated />
        </div>
      ) : privUsers.length === 0 ? (
        <div
          style={{
            padding: '0 16px 12px',
            color: 'var(--app-color-subtle-text)',
          }}
        >
          {t('admin.noPrivilegedUsers')}
        </div>
      ) : (
        <List>
          {privUsers.map((u) => (
            <List.Item
              key={u.user_id}
              prefix={
                <Avatar
                  src={u.picture_url ?? ''}
                  fallback={(u.display_name ?? u.user_id)
                    .charAt(0)
                    .toUpperCase()}
                  style={{ '--size': '36px', '--border-radius': '50%' }}
                />
              }
              extra={
                <Button
                  size="mini"
                  fill="outline"
                  color="danger"
                  onClick={() => {
                    handleRevokeRole(u.user_id);
                  }}
                >
                  {t('admin.removeRole')}
                </Button>
              }
              description={
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Tag
                    color={u.role === 'admin' ? 'primary' : 'default'}
                    fill="outline"
                  >
                    {u.role === 'admin'
                      ? t('admin.roleAdmin')
                      : t('admin.roleDriver')}
                  </Tag>
                  <Tag fill="outline">{u.provider}</Tag>
                </div>
              }
            >
              {u.display_name ?? u.user_id}
            </List.Item>
          ))}
        </List>
      )}
    </Layout>
  );
}
