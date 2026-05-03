import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Button,
  Dialog,
  Form,
  List,
  SearchBar,
  Skeleton,
  Tag,
  Toast,
} from 'antd-mobile';
import { FilterOutline } from 'antd-mobile-icons';
import Layout from '../../components/Layout';
import { useContainer } from '../../hooks/useContainer';
import { useTranslation } from '../../lib/useTranslation';
import { fetchApi, mutateApi } from '../../lib/queries';
import { formatDateTimeUtc } from '../../lib/date-format';

interface RegistrationAdminRow {
  registration_id: string;
  user_id: string;
  display_name: string | null;
  picture_url: string | null;
  route_code: string;
  route_name: string | null;
  route_display_name: string | null;
  route_stop_id: string;
  sequence: number;
  pickup_time: string | null;
  place_name: string;
  place_display_name: string | null;
  status: string;
  registered_at: string | null;
  updated_at: string | null;
}

function formatDate(iso: string | null): string {
  return formatDateTimeUtc(iso);
}

type RegStatus = 'active' | 'inactive' | 'all';
type RegGroupBy = 'route' | 'user';

interface RegistrationRowProps {
  row: RegistrationAdminRow;
  deleting: boolean;
  onDelete: (row: RegistrationAdminRow) => void;
  showRoute?: boolean;
}

function RegistrationRow({
  row,
  deleting,
  onDelete,
  showRoute,
}: RegistrationRowProps) {
  const stopName = row.place_display_name ?? row.place_name;
  const userName = row.display_name ?? row.user_id;
  const isActive = row.status === 'active';

  return (
    <List.Item
      prefix={
        <Avatar
          src={row.picture_url ?? ''}
          fallback={userName.charAt(0).toUpperCase()}
          style={{ '--size': '36px', '--border-radius': '50%' }}
        />
      }
      extra={
        <Button
          size="mini"
          fill="outline"
          color="danger"
          loading={deleting}
          onClick={() => onDelete(row)}
        >
          Delete
        </Button>
      }
      description={
        <span
          style={{
            color: 'var(--app-color-subtle-text)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <Tag color={isActive ? 'success' : 'default'} fill="outline">
            {row.status}
          </Tag>
          {showRoute && (
            <span style={{ color: 'var(--adm-color-primary)' }}>
              {row.route_code}
            </span>
          )}
          <span>
            {stopName}
            {row.pickup_time ? ` · ${row.pickup_time}` : ''}
          </span>
          <span>{formatDate(row.registered_at ?? row.updated_at)}</span>
        </span>
      }
    >
      {userName}
    </List.Item>
  );
}

function renderByRoute(
  rows: RegistrationAdminRow[],
  deletingId: string | null,
  onDelete: (row: RegistrationAdminRow) => void,
) {
  const grouped = rows.reduce<Record<string, RegistrationAdminRow[]>>(
    (acc, row) => {
      if (!acc[row.route_code]) acc[row.route_code] = [];
      acc[row.route_code].push(row);
      return acc;
    },
    {},
  );

  return Object.keys(grouped)
    .sort()
    .map((routeCode) => {
      const group = grouped[routeCode];
      const first = group[0];
      const routeLabel =
        first.route_display_name ?? first.route_name ?? routeCode;
      return (
        <List
          key={routeCode}
          header={
            <span>
              {routeLabel}{' '}
              <Tag color="primary" fill="outline" style={{ marginLeft: 4 }}>
                {group.length}
              </Tag>
            </span>
          }
        >
          {group.map((row) => (
            <RegistrationRow
              key={row.registration_id}
              row={row}
              deleting={deletingId === row.registration_id}
              onDelete={onDelete}
            />
          ))}
        </List>
      );
    });
}

function renderByUser(
  rows: RegistrationAdminRow[],
  deletingId: string | null,
  onDelete: (row: RegistrationAdminRow) => void,
) {
  const grouped = rows.reduce<Record<string, RegistrationAdminRow[]>>(
    (acc, row) => {
      if (!acc[row.user_id]) acc[row.user_id] = [];
      acc[row.user_id].push(row);
      return acc;
    },
    {},
  );

  const sortedUserIds = Object.keys(grouped).sort((a, b) => {
    const nameA = (grouped[a][0].display_name ?? a).toLowerCase();
    const nameB = (grouped[b][0].display_name ?? b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return sortedUserIds.map((userId) => {
    const group = grouped[userId];
    const first = group[0];
    const userName = first.display_name ?? userId;
    const activeCount = group.filter((r) => r.status === 'active').length;
    return (
      <List
        key={userId}
        header={
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar
              src={first.picture_url ?? ''}
              fallback={userName.charAt(0).toUpperCase()}
              style={{ '--size': '20px', '--border-radius': '50%' }}
            />
            {userName}
            {activeCount > 0 && (
              <Tag color="success" fill="outline" style={{ marginLeft: 2 }}>
                {activeCount} active
              </Tag>
            )}
          </span>
        }
      >
        {group.map((row) => (
          <RegistrationRow
            key={row.registration_id}
            row={row}
            deleting={deletingId === row.registration_id}
            onDelete={onDelete}
            showRoute
          />
        ))}
      </List>
    );
  });
}

export default function AdminRegistrationsPage() {
  const t = useTranslation();
  useContainer(t('admin.subtitle'));

  const queryClient = useQueryClient();

  const [regStatus, setRegStatus] = useState<RegStatus>('active');
  const [regGroupBy, setRegGroupBy] = useState<RegGroupBy>('route');
  const [draftStatus, setDraftStatus] = useState<RegStatus>('active');
  const [draftGroupBy, setDraftGroupBy] = useState<RegGroupBy>('route');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: registrations = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ['admin', 'registrations', regStatus],
    queryFn: () =>
      fetchApi<RegistrationAdminRow[]>(
        `/api/v1/admin/registrations?status=${regStatus}`,
      ),
  });

  const error = queryError
    ? process.env.NODE_ENV === 'development'
      ? queryError.message
      : t('admin.loadError')
    : null;

  const deleteMutation = useMutation({
    mutationFn: (registrationId: string) =>
      mutateApi<void>(
        `/api/v1/admin/registrations/${encodeURIComponent(registrationId)}`,
        { method: 'DELETE' },
      ),
    onSuccess: (_data, registrationId) => {
      Toast.show({ content: 'Registration deleted.', icon: 'success' });
      // Optimistically remove from cache
      queryClient.setQueryData<RegistrationAdminRow[]>(
        ['admin', 'registrations', regStatus],
        (old) => old?.filter((r) => r.registration_id !== registrationId) ?? [],
      );
    },
    onError: () => {
      Toast.show({ content: t('admin.loadError'), icon: 'fail' });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = useCallback(
    async (row: RegistrationAdminRow) => {
      const userName = row.display_name ?? row.user_id;
      const stopName = row.place_display_name ?? row.place_name;
      const confirmed = await Dialog.confirm({
        title: 'Delete Registration',
        content: `Remove ${userName}'s registration at "${stopName}" (${row.route_code})?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });
      if (!confirmed) return;

      setDeletingId(row.registration_id);
      deleteMutation.mutate(row.registration_id);
    },
    [deleteMutation],
  );

  const filtered = registrations.filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (row.display_name ?? '').toLowerCase().includes(q) ||
      row.user_id.toLowerCase().includes(q) ||
      (row.place_display_name ?? row.place_name).toLowerCase().includes(q) ||
      row.route_code.toLowerCase().includes(q)
    );
  });

  const selectStyle: React.CSSProperties = {
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--app-color-title)',
    font: 'inherit',
    outline: 'none',
    textAlign: 'right',
  };

  const openFilters = () => {
    setDraftStatus(regStatus);
    setDraftGroupBy(regGroupBy);
    setFiltersOpen((open) => !open);
  };

  const applyFilters = () => {
    setRegStatus(draftStatus);
    setRegGroupBy(draftGroupBy);
    setFiltersOpen(false);
  };

  return (
    <Layout showTabBar={false}>
      {loading ? (
        <div style={{ padding: 16 }}>
          <Skeleton.Title animated />
          <Skeleton.Paragraph lineCount={6} animated />
        </div>
      ) : error ? (
        <div style={{ padding: 16, color: 'var(--adm-color-danger)' }}>
          {error}
        </div>
      ) : (
        <>
          <div
            style={{
              padding: '10px 16px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <SearchBar
                placeholder="Search by name, stop, or route..."
                value={search}
                onChange={setSearch}
                clearable
                style={{
                  flex: 1,
                  '--height': '40px',
                  '--border-radius': '20px',
                  '--background': 'var(--adm-color-background)',
                }}
              />
              <Button
                fill="outline"
                shape="rounded"
                aria-label="Filters"
                onClick={openFilters}
                style={{
                  '--border-radius': '50%',
                  width: 40,
                  height: 40,
                  padding: 0,
                  minWidth: 40,
                }}
              >
                <FilterOutline fontSize={20} />
              </Button>
            </div>

            {filtersOpen && (
              <Form
                layout="horizontal"
                mode="card"
                footer={
                  <Button block color="primary" onClick={applyFilters}>
                    Apply
                  </Button>
                }
                style={{
                  margin: 0,
                  '--border-top': '0',
                  '--border-bottom': '0',
                  '--border-inner': '1px solid var(--app-color-border)',
                }}
              >
                <Form.Item label="Status">
                  <select
                    value={draftStatus}
                    onChange={(event) =>
                      setDraftStatus(event.target.value as RegStatus)
                    }
                    style={selectStyle}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="all">All</option>
                  </select>
                </Form.Item>
                <Form.Item label="Group">
                  <select
                    value={draftGroupBy}
                    onChange={(event) =>
                      setDraftGroupBy(event.target.value as RegGroupBy)
                    }
                    style={selectStyle}
                  >
                    <option value="route">By Route</option>
                    <option value="user">By User</option>
                  </select>
                </Form.Item>
              </Form>
            )}

            <div style={{ color: 'var(--app-color-subtle-text)' }}>
              {t('admin.totalCount', { count: filtered.length })}
              {registrations.length !== filtered.length &&
                ` / ${registrations.length}`}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div
              style={{
                padding: '12px 16px',
                color: 'var(--app-color-subtle-text)',
              }}
            >
              {t('admin.empty')}
            </div>
          ) : regGroupBy === 'route' ? (
            renderByRoute(filtered, deletingId, handleDelete)
          ) : (
            renderByUser(filtered, deletingId, handleDelete)
          )}
        </>
      )}
    </Layout>
  );
}
