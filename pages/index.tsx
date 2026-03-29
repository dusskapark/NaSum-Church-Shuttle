import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import {
  Button,
  Footer,
  FloatingPanel,
  List,
  Skeleton,
  Space,
  Toast,
} from "antd-mobile";
import {
  CompassOutline,
  EnvironmentOutline,
  ScanCodeOutline,
  SetOutline,
} from "antd-mobile-icons";
import { useLiff } from "../hooks/useLiff";
import { getCopy } from "../lib/copy";
import type {
  Nullable,
  RegisteredUserResponse,
  RegistrationWithRelations,
  RouteWithStations,
  RoutesResponse,
  Station,
} from "../lib/types";

const ShuttleMap = dynamic(() => import("./components/ShuttleMap"), {
  ssr: false,
});

function getAnchors(): number[] {
  if (typeof window === "undefined") return [420, 620, 820];
  return [
    Math.round(window.innerHeight * 0.5),
    Math.round(window.innerHeight * 0.72),
    Math.round(window.innerHeight * 0.92),
  ];
}

function getRouteLabel(route: RouteWithStations): string {
  return `${route.line} LINE (${route.service})`;
}

export default function ShuttleHome() {
  const router = useRouter();
  const { user, loading: liffLoading } = useLiff();
  const copy = getCopy("en");

  const [regLoading, setRegLoading] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [registration, setRegistration] =
    useState<Nullable<RegistrationWithRelations>>(null);
  const [routes, setRoutes] = useState<RoutesResponse>([]);
  const [selectedRouteIdState, setSelectedRouteIdState] =
    useState<Nullable<string>>(null);
  const [anchors, setAnchors] = useState<number[]>([420, 620, 820]);

  useEffect(() => {
    const syncAnchors = () => {
      setAnchors(getAnchors());
    };

    const frameId = window.requestAnimationFrame(syncAnchors);
    window.addEventListener("resize", syncAnchors);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", syncAnchors);
    };
  }, []);

  useEffect(() => {
    void fetch("/api/v1/routes")
      .then(async (response) => (await response.json()) as RoutesResponse)
      .then((data) => {
        setRoutes(data);
      })
      .catch(() =>
        Toast.show({ content: copy.common.routeLoadError, icon: "fail" }),
      )
      .finally(() => setRoutesLoading(false));
  }, [copy.common.routeLoadError]);

  useEffect(() => {
    if (!user) return;

    void (async () => {
      setRegLoading(true);

      try {
        const response = await fetch(
          `/api/v1/user-registration?provider=line&provider_uid=${encodeURIComponent(user.userId)}`,
        );
        const data = (await response.json()) as RegisteredUserResponse;
        if (data.registered) {
          setRegistration(data.registration ?? null);
        } else {
          setRegistration(null);
        }
      } catch {
        Toast.show({ content: copy.common.serverError, icon: "fail" });
      } finally {
        setRegLoading(false);
      }
    })();
  }, [copy.common.serverError, user]);

  const isLoading = liffLoading || regLoading || routesLoading;
  const selectedRouteId =
    selectedRouteIdState ?? registration?.route?.id ?? routes[0]?.id ?? null;
  const selectedRoute = useMemo(
    () => routes.find((route) => route.id === selectedRouteId) ?? null,
    [routes, selectedRouteId],
  );
  const selectedStations: Station[] = selectedRoute?.stations ?? [];
  const myStation = useMemo<Nullable<Station>>(() => {
    if (
      !registration?.station ||
      !selectedRoute ||
      registration.route.id !== selectedRoute.id
    ) {
      return null;
    }
    return registration.station;
  }, [registration, selectedRoute]);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <ShuttleMap stations={selectedStations} myStation={myStation} />
      </div>

      <FloatingPanel anchors={anchors} style={{ "--z-index": "20" }}>
        <div
          style={{
            padding: 0,
            background: "var(--adm-color-background)",
          }}
        >
          <div style={{ padding: "0 12px 12px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
              {copy.home.panelTitle}
            </div>
            <div style={{ marginTop: 2, fontSize: 13, color: "#6b7280" }}>
              {copy.home.panelHint}
            </div>
          </div>

          {isLoading ? (
            <>
              <Skeleton.Title animated />
              <Skeleton.Paragraph lineCount={7} animated />
            </>
          ) : (
            <>
              {registration ? (
                <List
                  header={copy.home.myRouteHeader}
                  style={{
                    "--border-top": "none",
                    "--border-bottom": "none",
                    marginBottom: 12,
                  }}
                >
                  <List.Item
                    prefix={<CompassOutline />}
                    description={`${registration.station.name}${registration.station.pickup_time ? ` · ${copy.common.rideAt} ${registration.station.pickup_time}` : ""}`}
                    extra={copy.home.selectedBadge}
                    onClick={() => {
                      void router.push({
                        pathname: "/stops",
                        query: { stationId: registration.station.id },
                      });
                    }}
                  >
                    {getRouteLabel(registration.route)}
                  </List.Item>
                  <List.Item
                    prefix={<EnvironmentOutline />}
                    onClick={() => {
                      if (registration.route.google_maps_url) {
                        window.open(
                          registration.route.google_maps_url,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }
                    }}
                  >
                    {copy.home.viewRouteMap}
                  </List.Item>
                </List>
              ) : null}

              {routes.length === 0 ? (
                <div style={{ fontSize: 14, color: "#6b7280" }}>
                  {copy.home.noRoutes}
                </div>
              ) : (
                <List
                  header={copy.home.routesHeader}
                  style={{
                    "--border-top": "none",
                    "--border-bottom": "none",
                    marginBottom: 12,
                  }}
                >
                  {routes.map((route) => {
                    const stopCount = route.stations.filter(
                      (station) => !station.is_terminal,
                    ).length;

                    return (
                      <List.Item
                        key={route.id}
                        clickable
                        prefix={<CompassOutline />}
                        extra={`${stopCount} ${copy.home.stopCount}`}
                        onClick={() => {
                          setSelectedRouteIdState(route.id);
                        }}
                      >
                        {getRouteLabel(route)}
                      </List.Item>
                    );
                  })}
                </List>
              )}

              <div style={{ padding: "8px 12px 0" }}>
                <Footer
                  label={copy.home.footerLabel}
                  content={copy.home.footerContent}
                />
              </div>

              <div
                style={{
                  height: "calc(88px + env(safe-area-inset-bottom) + 24px)",
                }}
              />
            </>
          )}
        </div>
      </FloatingPanel>

      <div
        style={{
          position: "fixed",
          right: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
          pointerEvents: "none",
          padding: "12px 12px calc(env(safe-area-inset-bottom) + 12px)",
          background: "var(--adm-color-background)",
          boxShadow: "0 -8px 24px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            alignItems: "center",
            gap: 12,
            pointerEvents: "auto",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <Button
              size="large"
              color="primary"
              style={{ width: "100%", height: 48, borderRadius: 999 }}
              onClick={() => {
                Toast.show({ content: copy.home.qrComingSoon, icon: "info" });
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <ScanCodeOutline fontSize={18} />
                <span>{copy.home.scanQr}</span>
              </span>
            </Button>
          </div>

          <Button
            size="large"
            fill="none"
            
            style={{
              borderRadius: "50%",
              flex: "none",
            }}
            onClick={() => {
              void router.push("/settings");
            }}
            aria-label={copy.home.profileAriaLabel}
          >
            <SetOutline fontSize={22} />
          </Button>
        </div>
      </div>
    </div>
  );
}
