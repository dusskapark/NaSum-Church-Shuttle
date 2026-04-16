import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from '@/lib/router';
import {
  Button,
  IndexBar,
  List,
  PullToRefresh,
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
type LocationStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'unsupported';

function isUnusableCoordinates(coords: GeolocationCoordinates): boolean {
  const isZeroPoint =
    Math.abs(coords.latitude) < 0.000001 && Math.abs(coords.longitude) < 0.000001;
  const accuracy = coords.accuracy;
  const isInvalidAccuracy = !Number.isFinite(accuracy) || accuracy <= 0;
  const isTooWide = accuracy > 5000;
  return isZeroPoint || isInvalidAccuracy || isTooWide;
}

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
  const searchBarContainerRef = useRef<HTMLDivElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');

  useEffect(() => {
    const input = searchBarContainerRef.current?.querySelector<HTMLInputElement>(
      'input.adm-input-element',
    );
    if (!input) return;
    input.id = 'search-stops-input';
    input.name = 'searchStops';
  }, []);

  useEffect(() => {
    if (viewMode !== 'list') return;
    const radios = document.querySelectorAll<HTMLInputElement>(
      'input.adm-segmented-item-input[type="radio"]',
    );
    radios.forEach((radio, index) => {
      if (!radio.name) radio.name = 'search-sort-mode';
      if (!radio.id) radio.id = `search-sort-mode-${index}`;
    });
  }, [viewMode, sortMode]);

  const requestCoordinates = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) {
      setLocationStatus('unsupported');
      Toast.show({ content: t('search.distanceUnavailable'), icon: 'fail' });
      return;
    }

    setLocationStatus('loading');

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isUnusableCoordinates(position.coords)) {
            setLocationStatus('blocked');
            Toast.show({
              content: t('search.distanceUnavailable'),
              icon: 'fail',
            });
            resolve();
            return;
          }

          setCoordinates({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationStatus('ready');
          resolve();
        },
        () => {
          setLocationStatus('blocked');
          Toast.show({
            content: t('search.distanceUnavailable'),
            icon: 'fail',
          });
          resolve();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }, [t]);

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
          <div
            ref={searchBarContainerRef}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
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
                const nextSortMode = value as SortMode;
                setSortMode(nextSortMode);
                if (nextSortMode === 'distance') {
                  void requestCoordinates();
                }
              }}
              options={[
                { label: t('search.alphabetical'), value: 'alphabetical' },
                { label: t('search.distance'), value: 'distance' },
              ]}
            />
            {sortMode === 'distance' ? (
              <div
                style={{
                  marginTop: 8,
                  color: 'var(--app-color-subtle-text)',
                  fontSize: 12,
                }}
              >
                {locationStatus === 'loading'
                  ? null
                  : coordinates
                    ? t('search.pullToRefreshHint')
                    : null}
              </div>
            ) : null}
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
              <PullToRefresh onRefresh={requestCoordinates}>
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
              </PullToRefresh>
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
