import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from '@/lib/router';
import {
  Dialog,
  Footer,
  FloatingPanel,
  List,
  NavBar,
  Skeleton,
} from 'antd-mobile';
import { CompassOutline } from 'antd-mobile-icons';
import Layout from '../../components/Layout';
import HomeRouteDetail from '../../components/RouteDetails';
import { useRegistration } from '../../hooks/useRegistration';
import { useRoutes } from '../../hooks/useRoutes';
import { useLineUser } from '../../hooks/useLineUser';
import { useHideLoader } from '../../hooks/useHideLoader';
import { useContainer } from '../../hooks/useContainer';
import { useRunStatus } from '../../hooks/useRunStatus';
import { useAppSettings } from '../../lib/app-settings';
import { useTranslation } from '../../lib/useTranslation';
import { getRouteLabel, getVisibleStops } from '../../lib/routeSelectors';
import type { Nullable, RouteStopWithPlace } from '@app-types/core';

const ShuttleMap = lazy(() =>
  import('../../components/Maps').then((mod) => ({ default: mod.ShuttleMap })),
);

function getAnchors(): number[] {
  return [
    Math.round(window.innerHeight * 0.5),
    Math.round(window.innerHeight * 0.72),
    Math.round(window.innerHeight * 0.92),
  ];
}

export default function ShuttleHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: lineLoading } = useLineUser();
  const { lang } = useAppSettings();
  const t = useTranslation();
  useContainer(t('home.panelTitle'));
  const { routes, loading: routesLoading } = useRoutes(
    t('common.routeLoadError'),
  );
  const {
    registration,
    stop_active,
    loading: regLoading,
  } = useRegistration(user?.providerUid ?? null, t('common.serverError'));

  const selectedRouteCode = searchParams.get('route');
  const registeredRouteCode = registration?.route?.route_code ?? null;
  const { activeRun } = useRunStatus(selectedRouteCode ?? registeredRouteCode);
  const selectedRouteStopId = searchParams.get('stop');
  const [anchors, setAnchors] = useState<number[]>([420, 620, 820]);
  const hasAutoNavigated = useRef(false);

  useEffect(() => {
    const syncAnchors = () => {
      setAnchors(getAnchors());
    };

    const frameId = window.requestAnimationFrame(syncAnchors);
    window.addEventListener('resize', syncAnchors);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncAnchors);
    };
  }, []);

  const panelRouteCode =
    !routesLoading && selectedRouteCode ? selectedRouteCode : null;
  const isLoading = lineLoading || regLoading || routesLoading;

  // Invalid deep-link guard:
  // if route/stop query does not exist in current route data, redirect to root.
  useEffect(() => {
    if (routesLoading) return;

    if (selectedRouteCode) {
      const route = routes.find((item) => item.route_code === selectedRouteCode);
      if (!route) {
        hasAutoNavigated.current = true;
        navigate('/', { replace: true });
        return;
      }

      if (
        selectedRouteStopId &&
        !route.stops.some((stop) => stop.id === selectedRouteStopId)
      ) {
        hasAutoNavigated.current = true;
        navigate('/', { replace: true });
      }
    }
  }, [navigate, routes, routesLoading, selectedRouteCode, selectedRouteStopId]);

  // On first load, auto-navigate to the registered route (replace history so back goes to list)
  useEffect(() => {
    if (
      !isLoading &&
      registration &&
      !selectedRouteCode &&
      !hasAutoNavigated.current
    ) {
      hasAutoNavigated.current = true;
      navigate(`/?route=${registration.route.route_code}`, { replace: true });
    }
  }, [isLoading, registration, selectedRouteCode, navigate]);

  // Notify user if their registered stop was deactivated after a schedule publish
  useEffect(() => {
    if (!isLoading && registration && !stop_active) {
      Dialog.confirm({
        content:
          lang === 'ko'
            ? '정류소가 변경됐습니다. 새 정류소를 선택해주세요.'
            : 'Your stop has changed. Please select a new stop.',
        confirmText: lang === 'ko' ? '선택하러 가기' : 'Select Stop',
        cancelText: lang === 'ko' ? '나중에' : 'Later',
        onConfirm: () => {
          navigate('/search');
        },
      });
    }
  }, [isLoading, registration, stop_active, lang, navigate]);
  useHideLoader(!isLoading);
  const actualSelectedRouteCode =
    selectedRouteCode ??
    registration?.route?.route_code ??
    routes[0]?.route_code ??
    null;

  const selectedRoute = useMemo(
    () =>
      routes.find((route) => route.route_code === actualSelectedRouteCode) ??
      null,
    [routes, actualSelectedRouteCode],
  );

  const panelRoute = useMemo(
    () => routes.find((route) => route.route_code === panelRouteCode) ?? null,
    [panelRouteCode, routes],
  );

  const selectedStops = selectedRoute?.stops ?? [];

  const myStop = useMemo<Nullable<RouteStopWithPlace>>(() => {
    if (selectedRouteStopId && selectedRoute) {
      const urlStop = selectedRoute.stops.find(
        (stop) => stop.id === selectedRouteStopId,
      );
      if (urlStop) return urlStop;
    }

    if (
      registration?.route_stop &&
      selectedRoute &&
      registration.route.route_code === selectedRoute.route_code
    ) {
      return registration.route_stop;
    }

    return null;
  }, [selectedRouteStopId, selectedRoute, registration]);

  const handleStopSelect = (routeCode: string, routeStopId: string) => {
    navigate(`/?route=${routeCode}&stop=${routeStopId}`);
  };

  return (
    <Layout>
      <div
        style={{
          position: 'relative',
          width: '100vw',
          height: 'var(--app-content-height)',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <Suspense fallback={null}>
            <ShuttleMap
              stops={selectedStops}
              cachedPath={selectedRoute?.cachedPath ?? []}
              pathCacheStatus={selectedRoute?.pathCacheStatus ?? null}
              myStop={myStop}
              stopStates={
                activeRun?.route_code === actualSelectedRouteCode
                  ? activeRun.stop_states
                  : undefined
              }
              currentLocationAriaLabel={t('home.currentLocationAriaLabel')}
              currentLocationUnavailable={t('home.currentLocationUnavailable')}
            />
          </Suspense>
        </div>

        <FloatingPanel anchors={anchors} style={{ '--z-index': '20' }}>
          <div
            style={{
              padding: 0,
              background: 'var(--adm-color-background)',
            }}
          >
            {isLoading ? (
              <>
                <Skeleton.Title animated />
                <Skeleton.Paragraph lineCount={7} animated />
              </>
            ) : panelRoute ? (
              <>
                <HomeRouteDetail
                  route={panelRoute}
                  title={getRouteLabel(panelRoute)}
                  backLabel={t('home.routeDetailBack')}
                  stopCountLabel={t('home.stopCount')}
                  isInService={activeRun?.route_code === panelRoute.route_code}
                  inServiceLabel={t('checkin.inService')}
                  boardedCountLabel={t('checkin.totalPassengers', {
                    count: '{count}',
                  })}
                  myStop={
                    registration?.route.route_code === panelRoute.route_code
                      ? registration.route_stop
                      : null
                  }
                  selectedRouteStopId={selectedRouteStopId}
                  stopStates={
                    activeRun?.route_code === panelRoute.route_code
                      ? activeRun.stop_states
                      : undefined
                  }
                  arrivedLabel={t('checkin.arrived')}
                  waitingLabel={t('checkin.waiting')}
                  detailLabel={t('home.stationDetail')}
                  onBack={() => {
                    navigate('/');
                  }}
                  onStopSelect={(routeStopId) => {
                    handleStopSelect(panelRoute.route_code, routeStopId);
                  }}
                  onStopDetail={(googlePlaceId) => {
                    navigate(
                      `/stops?placeId=${encodeURIComponent(googlePlaceId)}`,
                    );
                  }}
                />
              </>
            ) : (
              <>
                <div
                  style={{
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--app-color-border)',
                  }}
                >
                  <NavBar
                    backArrow={false}
                    right={
                      registration ? (
                        <span
                          onClick={() => {
                            navigate(
                              `/?route=${registration.route.route_code}&stop=${registration.route_stop.id}`,
                            );
                          }}
                          style={{
                            color: 'var(--adm-color-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          My
                        </span>
                      ) : null
                    }
                  >
                    {t('home.panelTitle')}
                  </NavBar>
                </div>

                {routes.length === 0 ? (
                  <div style={{ paddingTop: 8 }}>
                    <div
                      style={{
                        color: 'var(--app-color-subtle-text)',
                      }}
                    >
                      {t('home.noRoutes')}
                    </div>
                  </div>
                ) : (
                  <div style={{ paddingTop: 8 }}>
                    <List
                      header={t('home.routesHeader')}
                      style={{
                        '--border-top': 'none',
                        '--border-bottom': 'none',
                        marginBottom: 12,
                      }}
                    >
                      {routes.map((route) => {
                        const stopCount = getVisibleStops(route).length;

                        return (
                          <List.Item
                            key={route.route_code}
                            clickable
                            prefix={<CompassOutline />}
                            extra={`${stopCount} ${t('home.stopCount')}`}
                            onClick={() => {
                              navigate(`/?route=${route.route_code}`);
                            }}
                          >
                            {getRouteLabel(route)}
                          </List.Item>
                        );
                      })}
                    </List>
                  </div>
                )}

                <div style={{ padding: '8px 12px 0' }}>
                  <Footer
                    label={t('home.footerLabel')}
                    content={t('home.footerContent')}
                  />
                </div>

                <div
                  style={{
                    height:
                      'calc(64px + env(safe-area-inset-bottom, 0px) + 24px)',
                  }}
                />
              </>
            )}
          </div>
        </FloatingPanel>
      </div>
    </Layout>
  );
}
