import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  IndexBar,
  List,
  SearchBar,
  Segmented,
  Skeleton,
  Toast,
} from 'antd-mobile';
import { EnvironmentOutline, UnorderedListOutline } from 'antd-mobile-icons';
import Layout from '../../components/Layout';
import { useRoutes } from '../../hooks/useRoutes';
import { useSearchUrlState } from '../../hooks/useUrlState';
import { useContainer } from '../../hooks/useContainer';
import { useTranslation } from '../../lib/useTranslation';
import {
  filterStationsByKeyword,
  getDistanceInKm,
  getUniqueStations,
  groupStationsByIndex,
  sortStationIndexes,
  sortStationsByDistance,
  type Coordinates,
} from '../../lib/routeSelectors';

const StationBrowserMap = lazy(() =>
  import('../../components/Maps').then((mod) => ({
    default: mod.StationBrowserMap,
  })),
);

type SortMode = 'alphabetical' | 'distance';

export default function SearchPage() {
  const navigate = useNavigate();
  const t = useTranslation();
  useContainer(t('search.title'));
  const { routes, loading: routesLoading } = useRoutes(
    t('common.routeLoadError'),
  );

  const {
    query: keyword,
    setQuery: setKeyword,
    view: viewMode,
    setView: setViewMode,
  } = useSearchUrlState();
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const locationRequestedRef = useRef(false);
  const locationNoticeShownRef = useRef(false);

  useEffect(() => {
    if (viewMode !== 'list') {
      return;
    }

    if (
      sortMode !== 'distance' ||
      coordinates ||
      locationRequestedRef.current
    ) {
      return;
    }

    if (!('geolocation' in navigator)) {
      if (!locationNoticeShownRef.current) {
        Toast.show({ content: t('search.distanceUnavailable'), icon: 'fail' });
        locationNoticeShownRef.current = true;
      }
      return;
    }

    locationRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        if (!locationNoticeShownRef.current) {
          Toast.show({
            content: t('search.distanceUnavailable'),
            icon: 'fail',
          });
          locationNoticeShownRef.current = true;
        }
        setSortMode('alphabetical');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, [coordinates, t, sortMode, viewMode]);

  const stations = useMemo(() => getUniqueStations(routes), [routes]);
  const filteredStations = useMemo(
    () => filterStationsByKeyword(stations, keyword),
    [keyword, stations],
  );
  const distanceSortedStations = useMemo(
    () => sortStationsByDistance(filteredStations, coordinates),
    [coordinates, filteredStations],
  );
  const groupedStations = useMemo(
    () => groupStationsByIndex(filteredStations),
    [filteredStations],
  );
  const stationIndexes = useMemo(
    () => sortStationIndexes(groupedStations),
    [groupedStations],
  );
  const visibleStations =
    sortMode === 'distance' ? distanceSortedStations : filteredStations;

  const nextViewLabel =
    viewMode === 'list' ? t('search.map') : t('search.list');
  const NextViewIcon =
    viewMode === 'list' ? EnvironmentOutline : UnorderedListOutline;

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '8px 12px 10px',
            background: 'var(--adm-color-background)',
            borderBottom: '1px solid var(--app-color-border)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchBar
              placeholder={t('search.searchPlaceholder')}
              value={keyword}
              onChange={setKeyword}
              style={{
                '--background': 'var(--adm-color-background)',
                '--border-radius': '10px',
                flex: 1,
              }}
            />
            <Button
              fill="none"
              size="small"
              onClick={() => {
                setViewMode(viewMode === 'list' ? 'map' : 'list');
              }}
              style={{
                color: 'var(--app-color-link)',
                padding: '8px 12px',
                minWidth: 'auto',
              }}
            >
              <NextViewIcon />
              <span> {nextViewLabel}</span>
            </Button>
          </div>
        </div>

        {viewMode === 'list' ? (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--adm-color-background)',
              borderBottom: '1px solid var(--app-color-border)',
            }}
          >
            <Segmented
              block
              value={sortMode}
              onChange={(value) => {
                setSortMode(value as SortMode);
              }}
              options={[
                { label: t('search.alphabetical'), value: 'alphabetical' },
                { label: t('search.distance'), value: 'distance' },
              ]}
            />
          </div>
        ) : null}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
          }}
        >
          {routesLoading ? (
            <div style={{ padding: 16 }}>
              <Skeleton.Title animated />
              <Skeleton.Paragraph lineCount={8} animated />
            </div>
          ) : viewMode === 'map' ? (
            <Suspense fallback={null}>
              <StationBrowserMap
                places={filteredStations}
                currentLocationAriaLabel={t('home.currentLocationAriaLabel')}
                currentLocationUnavailable={t(
                  'home.currentLocationUnavailable',
                )}
                onSelect={(googlePlaceId) => {
                  navigate(
                    `/stops?placeId=${encodeURIComponent(googlePlaceId)}`,
                  );
                }}
              />
            </Suspense>
          ) : sortMode === 'distance' ? (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <List>
                {visibleStations.map((station) => (
                  <List.Item
                    key={station.googlePlaceId}
                    description={
                      coordinates
                        ? `${getDistanceInKm(coordinates, { lat: station.lat, lng: station.lng }).toFixed(1)} km`
                        : undefined
                    }
                    onClick={() => {
                      navigate(
                        `/stops?placeId=${encodeURIComponent(station.googlePlaceId)}`,
                      );
                    }}
                  >
                    {station.name}
                  </List.Item>
                ))}
              </List>
              <div style={{ height: 16 }} />
            </div>
          ) : (
            <IndexBar
              style={{
                height: '100%',
                '--sticky-offset-top': '0px',
                paddingBottom: 16,
              }}
            >
              {stationIndexes.map((index) => (
                <IndexBar.Panel
                  key={index}
                  index={index}
                  title={index}
                  brief={index}
                >
                  <List>
                    {groupedStations[index].map((station) => (
                      <List.Item
                        key={station.googlePlaceId}
                        onClick={() => {
                          navigate(
                            `/stops?placeId=${encodeURIComponent(station.googlePlaceId)}`,
                          );
                        }}
                      >
                        {station.name}
                      </List.Item>
                    ))}
                  </List>
                </IndexBar.Panel>
              ))}
            </IndexBar>
          )}
        </div>
      </div>
    </Layout>
  );
}
