import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Dialog,
  Ellipsis,
  Form,
  ResultPage,
  Skeleton,
  SpinLoading,
  Stepper,
  Toast,
} from 'antd-mobile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../../components/Layout';
import { useGrabUser } from '../../hooks/useGrabUser';
import { useContainer } from '../../hooks/useContainer';
import { CameraModule, LocationModule } from '@grabjs/superapp-sdk';
import { useTranslation } from '../../lib/useTranslation';
import {
  getDistanceInKm,
  getVisibleStops,
  getRouteLabel,
  type Coordinates,
} from '../../lib/routeSelectors';
import { canManageRun } from '../../lib/roleUtils';
import {
  buildConsentDeeplink,
  getCurrentEnv,
} from '../../constants/appConfigs';
import { fetchApi, mutateApi } from '../../lib/queries';
import type {
  CheckinRequest,
  CheckinResponse,
  MyCheckinResponse,
  RegisteredUserResponse,
  RouteStopWithPlace,
  RouteWithStops,
  RunInfoResponse,
  Nullable,
} from '@app-types/core';

// Create singleton instances
const cameraModule = new CameraModule();
const locationModule = new LocationModule();

// ─── helpers ─────────────────────────────────────────────────────────────────

function getNearestStop(
  stops: RouteStopWithPlace[],
  coords: Nullable<Coordinates>,
): Nullable<RouteStopWithPlace> {
  if (!coords || stops.length === 0) return stops[0] ?? null;
  return [...stops].sort(
    (a, b) =>
      getDistanceInKm(coords, { lat: a.place.lat, lng: a.place.lng }) -
      getDistanceInKm(coords, { lat: b.place.lat, lng: b.place.lng }),
  )[0];
}

function getStopLabel(stop: RouteStopWithPlace): string {
  return stop.place.display_name?.trim() || stop.place.name;
}

// ─── types ────────────────────────────────────────────────────────────────────

type CheckinPhase = 'idle' | 'confirm' | 'submitting' | 'success' | 'error';

// ─── component ───────────────────────────────────────────────────────────────

export default function ScanPage() {
  const { user, loading: grabLoading, isInClient, isReady } = useGrabUser();
  const t = useTranslation();

  const { sessionParams } = useContainer(t('scan.title'));

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get routeCode from URL params or sessionParams (sessionParams takes priority)
  const routeCodeFromUrl = searchParams.get('routeCode');
  const routeCodeFromSession = sessionParams?.routeCode;
  const routeCode = routeCodeFromSession || routeCodeFromUrl;

  // Sync URL when routeCode comes from sessionParams
  useEffect(() => {
    if (routeCodeFromSession && !routeCodeFromUrl) {
      setSearchParams({ routeCode: routeCodeFromSession }, { replace: true });
    }
  }, [routeCodeFromSession, routeCodeFromUrl, setSearchParams]);

  // ── scanner state (State B — no routeCode) ────────────────────────────────
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'warning' | 'error'>('warning');
  const hasAutoStartedRef = useRef(false);
  const userPickedStopRef = useRef(false);

  // ── registered stop (used to pre-select stop after scan) ─────────────────
  const queryClient = useQueryClient();
  const { data: regData } = useQuery<RegisteredUserResponse>({
    queryKey: ['registration', user?.userId],
    queryFn: () =>
      fetchApi<RegisteredUserResponse>(
        `/api/v1/user-registration?provider=grab&provider_uid=${encodeURIComponent(user!.userId)}`,
      ),
    enabled: isReady && !!user?.userId,
  });
  const registeredStopId =
    regData?.registered && regData.registration?.route_stop_id
      ? regData.registration.route_stop_id
      : null;

  // ── check-in state (State A — routeCode present) ──────────────────────────
  const [coords, setCoords] = useState<Nullable<Coordinates>>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [selectedStop, setSelectedStop] =
    useState<Nullable<RouteStopWithPlace>>(null);
  const [additionalPassengers, setAdditionalPassengers] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [phase, setPhase] = useState<CheckinPhase>('idle');
  const [checkinResult, setCheckinResult] =
    useState<Nullable<CheckinResponse>>(null);

  const isDriver = user ? canManageRun(user.role) : false;

  const goBack = useCallback(() => navigate('/'), [navigate]);
  const resetScan = useCallback(() => {
    setPhase('idle');
    setScanError(null);
    setCheckinResult(null);
    setSelectedStop(null);
    setAdditionalPassengers(0);
    userPickedStopRef.current = false;
    hasAutoStartedRef.current = false;
    setSearchParams({});
  }, [setSearchParams]);

  // ── fetch run info ────────────────────────────────────────────────────────
  const {
    data: runInfo,
    error: runInfoQueryError,
    isLoading: runInfoLoading,
  } = useQuery<RunInfoResponse>({
    queryKey: ['checkin', 'run', routeCode],
    queryFn: async () => {
      const data = await fetchApi<RunInfoResponse>(
        `/api/v1/checkin/run?routeCode=${encodeURIComponent(routeCode!)}`,
      );
      // Check server for an existing check-in for this run
      try {
        const me = await fetchApi<MyCheckinResponse>(
          `/api/v1/checkin/me?run_id=${encodeURIComponent(data.run.id)}`,
        );
        setCheckinResult({
          success: true,
          checkin_id: me.checkin_id,
          stop_state: me.stop_state,
        });
        setPhase('success');
      } catch {
        // no existing check-in — fall through to confirm
        setPhase('confirm');
      }
      return data;
    },
    enabled: !!routeCode,
    retry: false,
  });

  const runInfoError = runInfoQueryError
    ? runInfoQueryError.message.includes('404')
      ? t('checkin.noActiveRun')
      : t('checkin.error')
    : null;

  useEffect(() => {
    if (runInfoQueryError) setPhase('error');
  }, [runInfoQueryError]);

  // ── GPS location for automatic stop selection ───────────────────────────
  // Note: Requires mobile.geolocation scope in developer portal
  useEffect(() => {
    if (!routeCode || !isInClient || !isReady) return;

    async function getCurrentLocation() {
      setGpsLoading(true);
      console.log('[Location] getCoordinate starting...');
      try {
        const result = await locationModule.getCoordinate();
        console.log('[Location] getCoordinate result:', JSON.stringify(result));

        if (result.status_code === 200 && result.result) {
          // SDK returns latitude/longitude (not lat/lng)
          const raw = result.result as {
            latitude?: number;
            longitude?: number;
            lat?: number;
            lng?: number;
          };
          const lat = raw.latitude ?? raw.lat;
          const lng = raw.longitude ?? raw.lng;
          console.log('[Location] coordinates:', { lat, lng });
          if (lat != null && lng != null) {
            setCoords({ lat, lng });
          }
        } else if (result.status_code === 403) {
          console.warn(
            '[Location] permission denied (403) — user may need to grant location access',
          );
        } else {
          console.warn('[Location] unexpected status:', result.status_code);
        }
      } catch (err) {
        console.error('[Location] getCoordinate failed:', err);
      } finally {
        setGpsLoading(false);
      }
    }

    getCurrentLocation();
  }, [routeCode, isInClient, isReady]);

  // ── auto-select stop: registered stop first, fall back to GPS nearest ─────
  // Re-runs whenever visibleStops, coords, or registeredStopId changes.
  // Stops updating once the user has manually picked a stop in the Picker.
  const visibleStops = useMemo(
    () => (runInfo ? getVisibleStops(runInfo.route as RouteWithStops) : []),
    [runInfo],
  );

  useEffect(() => {
    if (visibleStops.length === 0) return;
    if (userPickedStopRef.current) return;

    // GPS가 있으면 최근접 정류소 우선 (같은 노선 등록 정류소라도 GPS 우선)
    if (coords) {
      const nearest = getNearestStop(visibleStops, coords);
      console.log(
        '[AutoSelect] GPS nearest stop:',
        nearest?.place.name,
        '| coords:',
        coords,
      );
      setSelectedStop(nearest);
      return;
    }

    // GPS 없음: 등록 정류소 fallback (같은 노선인 경우만 match됨)
    const registeredInCurrentRoute = registeredStopId
      ? (visibleStops.find((s) => s.id === registeredStopId) ?? null)
      : null;

    console.log(
      '[AutoSelect] No GPS — fallback to registered:',
      registeredInCurrentRoute?.place.name ?? 'none',
    );
    setSelectedStop(registeredInCurrentRoute ?? visibleStops[0] ?? null);
  }, [visibleStops, coords, registeredStopId]);

  // ── submit check-in ───────────────────────────────────────────────────────
  const checkinMutation = useMutation({
    mutationFn: (body: CheckinRequest) =>
      mutateApi<CheckinResponse>('/api/v1/checkin', {
        method: 'POST',
        body,
      }),
    onMutate: () => setPhase('submitting'),
    onSuccess: (data) => {
      setCheckinResult(data);
      setPhase('success');
      queryClient
        .invalidateQueries({ queryKey: ['run-status'] })
        .catch(() => {});
      queryClient
        .invalidateQueries({ queryKey: ['registration'] })
        .catch(() => {});
      setTimeout(() => {
        const params = new URLSearchParams();
        if (routeCode) params.set('route', routeCode);
        if (selectedStop) params.set('stop', selectedStop.id);
        navigate(`/?${params.toString()}`);
      }, 2500);
    },
    onError: () => setPhase('error'),
  });

  const handleCheckin = useCallback(async () => {
    if (!runInfo || !selectedStop || !user) return;
    checkinMutation.mutate({
      run_id: runInfo.run.id,
      route_stop_id: selectedStop.id,
      provider_uid: user.userId,
      provider: 'grab',
      display_name: user.displayName,
      picture_url: user.pictureUrl,
      additional_passengers: additionalPassengers,
    });
  }, [runInfo, selectedStop, user, additionalPassengers, checkinMutation]);

  // ── admin: start / end run ────────────────────────────────────────────────
  const startRunMutation = useMutation({
    mutationFn: (code: string) =>
      mutateApi('/api/v1/admin/runs', {
        method: 'POST',
        body: { route_code: code },
      }),
    onSuccess: () => {
      Toast.show({ content: t('checkin.startRun'), icon: 'success' });
      setPhase('idle');
      queryClient
        .invalidateQueries({ queryKey: ['checkin', 'run', routeCode] })
        .catch(() => {});
    },
    onError: () => Toast.show({ content: t('checkin.error'), icon: 'fail' }),
  });

  const handleStartRun = useCallback(async () => {
    if (!routeCode || !user) return;
    startRunMutation.mutate(routeCode);
  }, [routeCode, user, startRunMutation]);

  const endRunMutation = useMutation({
    mutationFn: (runId: string) =>
      mutateApi(`/api/v1/admin/runs/${runId}/end`, { method: 'POST' }),
    onSuccess: () => {
      Toast.show({ content: t('checkin.stopRun'), icon: 'success' });
      queryClient
        .invalidateQueries({ queryKey: ['run-status'] })
        .catch(() => {});
      setTimeout(() => navigate('/'), 1500);
    },
    onError: () => Toast.show({ content: t('checkin.error'), icon: 'fail' }),
  });

  const handleEndRun = useCallback(async () => {
    if (!runInfo || !user) return;
    endRunMutation.mutate(runInfo.run.id);
  }, [runInfo, user, endRunMutation]);

  // ── QR scan ───────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      if (!isInClient) {
        setScanStatus('error');
        setScanError(t('scan.availabilityLineOnly'));
        return;
      }

      const result = await cameraModule.scanQRCode({
        title: t('scan.scanButton'),
      });

      if (result.status_code === 204) {
        setScanStatus('warning');
        setScanError(t('scan.scanCancelled'));
        return;
      }
      if (result.status_code === 403) {
        setScanStatus('error');
        setScanError(t('scan.availabilityUnsupported'));
        return;
      }

      const value = result.result.qrCode;
      if (!value) {
        setScanStatus('warning');
        setScanError(t('scan.scanCancelled'));
        return;
      }

      // Parse app scheme URLs (grab:// or grab-qa://)
      try {
        const scannedUrl = new URL(value);

        // Check if it's a Grab app scheme
        if (
          scannedUrl.protocol === 'grab:' ||
          scannedUrl.protocol === 'grab-qa:'
        ) {
          console.log('[Scan] App scheme detected:', scannedUrl.toString());

          // Extract sessionParams from the URL
          const sessionParamsStr = scannedUrl.searchParams.get('sessionParams');
          if (sessionParamsStr) {
            try {
              const sessionParams = JSON.parse(
                decodeURIComponent(sessionParamsStr),
              );
              const routeCode = sessionParams?.routeCode;

              if (routeCode) {
                console.log(
                  '[Scan] RouteCode extracted from sessionParams:',
                  routeCode,
                );
                setSearchParams({ routeCode });
                return;
              }
            } catch (parseErr) {
              console.warn('[Scan] Failed to parse sessionParams:', parseErr);
            }
          }

          // Fallback: check for routeCode in URL parameters
          const routeCodeParam = scannedUrl.searchParams.get('routeCode');
          if (routeCodeParam) {
            console.log(
              '[Scan] RouteCode extracted from URL params:',
              routeCodeParam,
            );
            setSearchParams({ routeCode: routeCodeParam });
            return;
          }

          // App scheme detected but no routeCode found
          setScanStatus('warning');
          setScanError(
            `${t('scan.lastResult')}: App link detected but no route code found`,
          );
          return;
        }

        // Not a Grab app scheme - invalid QR code
        setScanStatus('warning');
        setScanError(
          `${t('scan.lastResult')}: Invalid QR code format. Please scan a valid shuttle bus QR code.`,
        );
      } catch {
        // Not a valid URL at all
        setScanStatus('warning');
        setScanError(
          `${t('scan.lastResult')}: Invalid QR code format. Expected Grab app link.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? `${t('scan.scanFailed')} ${error.message}`
          : t('scan.scanFailed');
      setScanStatus('error');
      setScanError(message);
    } finally {
      setIsScanning(false);
    }
  }, [t, isInClient, setSearchParams]);

  // Auto-start camera when no routeCode is found after initialization
  useEffect(() => {
    // Don't start scanner if we already have routeCode
    if (routeCode) return;

    // Wait for prerequisites (isReady ensures scopes are loaded)
    if (grabLoading || !isInClient || !isReady) return;

    // Don't auto-start multiple times
    if (hasAutoStartedRef.current) return;

    hasAutoStartedRef.current = true;
    handleScan().catch(() => {});
  }, [handleScan, isInClient, grabLoading, routeCode, isReady]);

  // Dev bypass: localhost or ?dev=true skips the isInClient / redirect guards.
  const devBypass =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      new URLSearchParams(window.location.search).get('dev') === 'true');

  // External browser: auto-launch Grab when routeCode is present.
  // Fires once grabLoading is false so we're certain isInClient is final.
  useEffect(() => {
    if (!routeCode) return;
    if (grabLoading) return;
    if (isInClient) return;
    if (devBypass) return;
    const sessionParamsToPass = routeCode ? { routeCode } : undefined;
    window.location.href = buildConsentDeeplink(
      getCurrentEnv(),
      sessionParamsToPass,
    );
  }, [routeCode, isInClient, grabLoading, devBypass]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // ── State A: routeCode present ────────────────────────────────────────────
  if (routeCode) {
    // External browser: show fallback after auto-redirect attempt
    if (!grabLoading && !isInClient && !devBypass) {
      const sessionParamsForFallback = routeCode ? { routeCode } : undefined;
      const deeplink = buildConsentDeeplink(
        getCurrentEnv(),
        sessionParamsForFallback,
      );
      return (
        <Layout showTabBar={false}>
          <ResultPage
            status="info"
            title={t('scan.openingGrabApp')}
            description={t('scan.openInGrabDescription')}
            primaryButtonText={t('scan.openInGrabButton')}
            onPrimaryButtonClick={() => {
              window.location.href = deeplink;
            }}
            secondaryButtonText={t('tabs.home')}
            onSecondaryButtonClick={goBack}
          />
        </Layout>
      );
    }

    const routeLabel = runInfo ? getRouteLabel(runInfo.route) : routeCode;

    const status = phase === 'error' ? 'error' : 'info';

    // Loading
    if (runInfoLoading) {
      return (
        <Layout showTabBar={false}>
          <ResultPage
            status="success"
            title={t('checkin.loading')}
            description={routeLabel}
          >
            <ResultPage.Card>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '24px 0',
                }}
              >
                <SpinLoading color="primary" style={{ '--size': '40px' }} />
              </div>
            </ResultPage.Card>
          </ResultPage>
        </Layout>
      );
    }

    // Success
    if (phase === 'success' && checkinResult && selectedStop) {
      const total = checkinResult.stop_state.total_passengers;
      return (
        <Layout showTabBar={false}>
          <ResultPage
            status="success"
            title={t('checkin.welcomeOnboard')}
            description={user?.displayName ?? routeLabel}
            details={[
              {
                label: t('checkin.selectStop'),
                value: getStopLabel(selectedStop),
                bold: true,
              },
              {
                label: t('checkin.totalPassengersLabel'),
                value: String(total),
              },
            ]}
            primaryButtonText={t('tabs.home')}
            onPrimaryButtonClick={goBack}
          >
            {isDriver && runInfo && (
              <ResultPage.Card>
                <Form
                  layout="horizontal"
                  mode="card"
                  footer={
                    <Button
                      block
                      color="danger"
                      fill="outline"
                      size="middle"
                      onClick={() => {
                        Dialog.confirm({
                          content: t('checkin.confirmEndRun'),
                          confirmText: t('checkin.stopRun'),
                          cancelText: t('stopDetail.cancelButton'),
                          onConfirm: () => handleEndRun(),
                        });
                      }}
                    >
                      {t('checkin.stopRun')}
                    </Button>
                  }
                >
                  <Form.Header>{t('checkin.runManagement')}</Form.Header>
                  <Form.Item label={t('checkin.route')}>
                    <span>{routeLabel}</span>
                  </Form.Item>
                </Form>
              </ResultPage.Card>
            )}
          </ResultPage>
        </Layout>
      );
    }

    // Error
    if (phase === 'error') {
      return (
        <Layout showTabBar={false}>
          <ResultPage
            status="error"
            title={t('checkin.title')}
            description={runInfoError ?? t('checkin.error')}
            primaryButtonText={t('scan.scanAgainButton')}
            onPrimaryButtonClick={resetScan}
            secondaryButtonText={t('tabs.home')}
            onSecondaryButtonClick={goBack}
          >
            {isDriver && (
              <ResultPage.Card>
                <Form
                  layout="horizontal"
                  mode="card"
                  footer={
                    <Button
                      block
                      color="primary"
                      size="middle"
                      onClick={() => handleStartRun()}
                    >
                      {t('checkin.startRun')}
                    </Button>
                  }
                >
                  <Form.Header>{t('checkin.runManagement')}</Form.Header>
                  <Form.Item label={t('checkin.route')}>
                    <span>{routeLabel}</span>
                  </Form.Item>
                </Form>
              </ResultPage.Card>
            )}
          </ResultPage>
        </Layout>
      );
    }

    // Confirm form
    return (
      <Layout showTabBar={false}>
        <ResultPage
          status={status}
          title={t('checkin.confirmTitle')}
          description={user?.displayName ?? routeLabel}
          primaryButtonText={t('checkin.submit')}
          onPrimaryButtonClick={handleCheckin}
          secondaryButtonText={t('scan.scanAgainButton')}
          onSecondaryButtonClick={resetScan}
        >
          {/* Driver: run management — shown first so End Run is prominent */}
          {isDriver && runInfo && (
            <ResultPage.Card>
              <Form
                layout="horizontal"
                mode="card"
                footer={
                  <Button
                    block
                    color="danger"
                    fill="outline"
                    size="middle"
                    onClick={() => {
                      Dialog.confirm({
                        content: t('checkin.confirmEndRun'),
                        confirmText: t('checkin.stopRun'),
                        cancelText: t('stopDetail.cancelButton'),
                        onConfirm: () => handleEndRun(),
                      });
                    }}
                  >
                    {t('checkin.stopRun')}
                  </Button>
                }
              >
                <Form.Header>{t('checkin.runManagement')}</Form.Header>
                <Form.Item label={t('checkin.route')}>
                  <span>{routeLabel}</span>
                </Form.Item>
              </Form>
            </ResultPage.Card>
          )}

          {/* Check-in fields */}
          <ResultPage.Card>
            <Form layout="horizontal" mode="card">
              <Form.Item label={t('checkin.route')}>
                <span>{routeLabel}</span>
              </Form.Item>
              <Form.Item
                label={t('checkin.selectStop')}
                clickable
                arrowIcon
                onClick={() => setPickerVisible(true)}
              >
                {gpsLoading && !selectedStop ? (
                  <Skeleton
                    animated
                    style={{ width: 140, height: 16, borderRadius: 4 }}
                  />
                ) : (
                  <span>
                    {selectedStop ? (
                      <>
                        {getStopLabel(selectedStop)}
                        {selectedStop.pickup_time && (
                          <span
                            style={{
                              color: 'var(--adm-color-weak)',
                              fontSize: 12,
                            }}
                          >
                            {` · ${selectedStop.pickup_time}`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </span>
                )}
              </Form.Item>
              <Form.Item label={t('checkin.additionalPassengers')}>
                <Stepper
                  min={0}
                  max={9}
                  value={additionalPassengers}
                  onChange={(val) => setAdditionalPassengers(val)}
                />
              </Form.Item>
            </Form>
          </ResultPage.Card>
        </ResultPage>

        <Dialog
          visible={pickerVisible}
          title={t('checkin.selectStop')}
          onClose={() => setPickerVisible(false)}
          closeOnMaskClick
          content={
            <div>
              {visibleStops.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    userPickedStopRef.current = true;
                    setSelectedStop(s);
                    setPickerVisible(false);
                  }}
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid var(--adm-color-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: selectedStop?.id === s.id ? 600 : 400,
                    color:
                      selectedStop?.id === s.id
                        ? 'var(--adm-color-primary)'
                        : 'inherit',
                  }}
                >
                  <span>
                    <Ellipsis content={getStopLabel(s)} />
                  </span>
                  {s.pickup_time && (
                    <span
                      style={{ fontSize: 12, color: 'var(--adm-color-weak)' }}
                    >
                      {s.pickup_time}
                    </span>
                  )}
                </div>
              ))}
            </div>
          }
          actions={[]}
        />
      </Layout>
    );
  }

  // ── State B: no routeCode — QR scanner ───────────────────────────────────

  if (!grabLoading && isReady && !isInClient) {
    return (
      <Layout showTabBar={false}>
        <ResultPage
          status="info"
          title={t('scan.title')}
          description={t('scan.availabilityExternal')}
          secondaryButtonText={t('tabs.home')}
          onSecondaryButtonClick={goBack}
        />
      </Layout>
    );
  }

  if (scanError) {
    return (
      <Layout showTabBar={false}>
        <ResultPage
          status={scanStatus}
          title={t('scan.title')}
          description={scanError}
          primaryButtonText={t('scan.scanAgainButton')}
          onPrimaryButtonClick={() => handleScan()}
          secondaryButtonText={t('tabs.home')}
          onSecondaryButtonClick={goBack}
        />
      </Layout>
    );
  }

  return (
    <Layout showTabBar={false}>
      <ResultPage
        status="waiting"
        title={t('scan.title')}
        description={isScanning ? t('scan.scanning') : t('scan.description')}
        primaryButtonText={isScanning ? undefined : t('scan.scanButton')}
        onPrimaryButtonClick={isScanning ? undefined : () => handleScan()}
        secondaryButtonText={t('tabs.home')}
        onSecondaryButtonClick={goBack}
      >
        {isScanning && (
          <ResultPage.Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '16px 0',
              }}
            >
              <SpinLoading color="primary" style={{ '--size': '36px' }} />
            </div>
          </ResultPage.Card>
        )}
      </ResultPage>
    </Layout>
  );
}
