import { Suspense, lazy, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from '@/lib/router';
import { Button, CheckList, SafeArea, Skeleton, Tag, Toast } from 'antd-mobile';
import { EnvironmentOutline } from 'antd-mobile-icons';
import type { CheckListValue } from 'antd-mobile/es/components/check-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { usePlaceRoutes } from '../../hooks/usePlaces';
import { useLineUser } from '../../hooks/useLineUser';
import { useContainer } from '../../hooks/useContainer';
import { useTranslation } from '../../lib/useTranslation';
import { mutateApi } from '../../lib/queries';
import { openExternalUrl } from '../../lib/open-external-url';
import type { StopCandidate, UserRegistrationRequest } from '@app-types/core';


const StopPreviewMap = lazy(() =>
  import('../../components/Maps').then((mod) => ({
    default: mod.StopPreviewMap,
  })),
);

export default function StopDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const placeId = searchParams.get('placeId');
  const { user, loading: lineLoading } = useLineUser();
  const t = useTranslation();
  const { sourceStop, matchingStops, loading: routesLoading } = usePlaceRoutes(
    placeId,
    t('common.routeLoadError'),
  );
  const queryClient = useQueryClient();

  const [selectedStopId, setSelectedStopId] = useState<CheckListValue[]>([]);

  useContainer(t('stopDetail.title'));

  const mapsUrl = useMemo<string | null>(() => {
    if (!sourceStop?.lat || !sourceStop?.lng) return null;
    return `https://www.google.com/maps?q=${sourceStop.lat},${sourceStop.lng}`;
  }, [sourceStop]);

  const addressLabel = useMemo<string | null>(() => {
    return sourceStop?.formattedAddress ?? sourceStop?.address ?? null;
  }, [sourceStop]);

  const selectedStop = useMemo<StopCandidate | null>(() => {
    const selectedId = selectedStopId[0];
    if (typeof selectedId !== 'string') return null;
    return (
      matchingStops.find((stop) => stop.routeStopId === selectedId) ?? null
    );
  }, [matchingStops, selectedStopId]);

  const registerMutation = useMutation({
    mutationFn: (payload: UserRegistrationRequest) =>
      mutateApi('/api/v1/user-registration', { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient
        .invalidateQueries({ queryKey: ['registration'] })
        .catch(() => {});
      Toast.show({ content: t('common.saveSuccess'), icon: 'success' });
      navigate('/');
    },
    onError: () => Toast.show({ content: t('common.saveError'), icon: 'fail' }),
  });

  function handleRegister(): void {
    if (!user || !selectedStop) return;
    registerMutation.mutate({
      provider_uid: user.providerUid,
      display_name: user.displayName,
      picture_url: user.pictureUrl,
      route_code: selectedStop.routeCode,
      route_stop_id: selectedStop.routeStopId,
      provider: 'line',
    });
  }

  return (
    <Layout showTabBar={false}>
      {/* ── Header ─────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--app-color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--app-color-title)',
              flex: 1,
            }}
          >
            {sourceStop?.name ?? '...'}
          </div>
          {sourceStop?.primaryTypeDisplayName && (
            <Tag color="primary" fill="outline">
              {sourceStop.primaryTypeDisplayName}
            </Tag>
          )}
          {sourceStop?.isTerminal && (
            <Tag color="success" fill="outline">
              Terminal
            </Tag>
          )}
        </div>
        <div
          style={{
            marginTop: 6,
            color: 'var(--app-color-subtle-text)',
          }}
        >
          {sourceStop?.stopId
            ? `${t('stopDetail.stopId')}: ${sourceStop.stopId}`
            : t('stopDetail.chooseRoute')}
        </div>
      </div>

      {/* ── Map Preview ────────────────────────────── */}
      {!routesLoading && sourceStop ? (
        <>
          <div style={{ height: 220, flexShrink: 0, position: 'relative' }}>
            <Suspense fallback={null}>
              <StopPreviewMap
                stop={selectedStop ?? sourceStop}
                previewLabel={t('stopDetail.stopPreview')}
                routeMapLabel={t('stopDetail.routeMap')}
                googleMapsLabel={t('common.openInGoogleMaps')}
              />
            </Suspense>
          </div>
          {mapsUrl && (
            <div
              style={{
                padding: '8px 16px',
                borderBottom: '1px solid var(--app-color-border)',
              }}
            >
              <Button
                fill="none"
                size="small"
                onClick={() => {
                  openExternalUrl(mapsUrl).catch(() => {});
                }}
                style={{ color: 'var(--app-color-link)', padding: 0 }}
              >
                <EnvironmentOutline style={{ marginRight: 4 }} />
                {addressLabel ?? t('common.openInGoogleMaps')}
              </Button>
            </div>
          )}
        </>
      ) : null}

      {/* ── Route Selection ────────────────────────── */}
      {routesLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton.Title animated />
          <Skeleton.Paragraph lineCount={6} animated />
        </div>
      ) : matchingStops.length === 0 ? (
        <div
          style={{
            padding: 16,
            color: 'var(--app-color-subtle-text)',
          }}
        >
          {t('stopDetail.noResults')}
        </div>
      ) : (
        <>
          <div style={{ padding: '10px 16px 8px' }}>
            <div
              style={{
                fontWeight: 600,
                color: 'var(--app-color-subtle-text)',
              }}
            >
              {t('stopDetail.chooseRouteSectionTitle')}
            </div>
          </div>

          <CheckList value={selectedStopId} onChange={setSelectedStopId}>
            {matchingStops.map((stop) => (
              <CheckList.Item key={stop.routeStopId} value={stop.routeStopId}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--app-color-title)',
                    }}
                  >
                    {stop.routeLabel}
                  </div>
                  <div
                    style={{
                      color: 'var(--app-color-secondary-text)',
                    }}
                  >
                    {t('stopDetail.stopOrder')} {stop.stopOrder}
                    {stop.pickupTime
                      ? ` · ${t('stopDetail.boardAt')} ${stop.pickupTime}`
                      : ''}
                  </div>
                </div>
              </CheckList.Item>
            ))}
          </CheckList>
        </>
      )}

      {/* ── Bottom Spacer (clears fixed button area) ── */}
      <div
        style={{ flexShrink: 0, height: 'calc(48px + 4px + 48px + 24px)' }}
      />
      <SafeArea position="bottom" />

      {/* ── Register Button ────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          left: 0,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
          background: 'var(--app-color-surface)',
          borderTop: '1px solid var(--app-color-border)',
        }}
      >
        <Button
          block
          size="large"
          color="primary"
          style={{ borderRadius: 999 }}
          disabled={!selectedStop || lineLoading}
          loading={registerMutation.isPending}
          onClick={handleRegister}
        >
          {selectedStop
            ? t('stopDetail.registerButton')
            : t('stopDetail.noSelection')}
        </Button>
        <Button
          block
          size="large"
          fill="none"
          style={{ borderRadius: 999, marginTop: 4 }}
          onClick={() => {
            navigate(-1);
          }}
        >
          {t('stopDetail.cancelButton')}
        </Button>
      </div>
    </Layout>
  );
}
