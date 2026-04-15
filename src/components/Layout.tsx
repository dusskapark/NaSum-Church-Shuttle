import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SafeArea, TabBar } from 'antd-mobile';
import {
  BellOutline,
  CompassOutline,
  SearchOutline,
  SetOutline,
  ScanningOutline,
} from 'antd-mobile-icons';
import { useQuery } from '@tanstack/react-query';
import { ContainerModule } from '@grabjs/superapp-sdk';
import { useTranslation } from '../lib/useTranslation';
import { fetchApi } from '../lib/queries';
import { useGrabUser } from '../hooks/useGrabUser';
import type { AppNotification } from '@app-types/core';
import { DEV_NOTIFICATIONS } from '../routes/notifications/_devData';

// Create singleton instance
const containerModule = new ContainerModule();

interface LayoutProps {
  children: ReactNode;
  style?: CSSProperties;
  showTabBar?: boolean;
  withSafeArea?: boolean;
}

type TabItem = {
  key: string;
  title: string;
  icon: ReactNode;
  badge?: number;
};

function HomeTabIcon({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        color: active ? 'var(--adm-color-primary)' : 'var(--app-color-title)',
      }}
    >
      <CompassOutline fontSize={22} />
    </span>
  );
}

function ScanTabIcon({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        color: active ? 'var(--adm-color-primary)' : 'var(--app-color-title)',
      }}
    >
      <ScanningOutline fontSize={22} />
    </span>
  );
}

export default function Layout({
  children,
  style,
  showTabBar = true,
  withSafeArea = true,
}: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isReady } = useGrabUser();

  const { data: notifications } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => fetchApi<AppNotification[]>('/api/v1/notifications'),
    enabled: isReady,
  });

  const unreadCount = useMemo(() => {
    const list =
      notifications && notifications.length > 0
        ? notifications
        : process.env.NODE_ENV === 'development'
          ? DEV_NOTIFICATIONS
          : [];
    return list.filter((n) => !n.is_read).length;
  }, [notifications]);

  useEffect(() => {
    try {
      if (showTabBar) {
        containerModule.hideBackButton().catch(() => {});
      } else {
        containerModule.showBackButton().catch(() => {});
      }
      containerModule.hideRefreshButton().catch(() => {});
    } catch {
      // Not in Grab MiniApp context — ignore
    }
  }, [showTabBar]);
  const t = useTranslation();
  const activeKey = useMemo(() => {
    if (location.pathname === '/search') return '/search';
    if (location.pathname === '/scan') return '/scan';
    if (location.pathname === '/notifications') return '/notifications';
    if (location.pathname === '/settings') return '/settings';
    if (location.pathname === '/admin') return '/admin';
    return '/';
  }, [location.pathname]);

  const tabs = useMemo<TabItem[]>(
    () => [
      {
        key: '/',
        title: t('tabs.home'),
        icon: <HomeTabIcon active={activeKey === '/'} />,
      },
      {
        key: '/search',
        title: t('tabs.stops'),
        icon: <SearchOutline fontSize={22} />,
      },
      {
        key: '/scan',
        title: t('tabs.scan'),
        icon: <ScanTabIcon active={activeKey === '/scan'} />,
      },
      {
        key: '/notifications',
        title: t('tabs.notifications'),
        icon: <BellOutline fontSize={22} />,
        badge: unreadCount > 0 ? unreadCount : undefined,
      },
      {
        key: '/settings',
        title: t('tabs.settings'),
        icon: <SetOutline fontSize={22} />,
      },
    ],
    [activeKey, t, unreadCount],
  );

  const baseStyle: CSSProperties = {
    width: '100%',
    height: '100dvh',
    background: 'var(--adm-color-background)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  };

  const tabBarStyle: CSSProperties & Record<'--adm-color-primary', string> = {
    '--adm-color-primary': 'var(--app-color-link)',
    height: 'var(--app-tab-bar-height)',
  };

  return (
    <div style={{ ...baseStyle, ...style }}>
      {withSafeArea && <SafeArea position="top" />}

      <div style={{ display: 'contents' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {children}
        </div>
        {showTabBar && (
          <div
            style={{
              flex: 'none',
              height:
                'calc(var(--app-tab-bar-height) + env(safe-area-inset-bottom, 0px))',
            }}
          />
        )}

        {showTabBar && (
          <div
            style={{
              position: 'fixed',
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 'var(--z-tabbar)' as unknown as number,
              background: 'var(--adm-color-background)',
              boxShadow: 'var(--app-shadow-toolbar)',
              borderTop: '1px solid var(--app-color-border)',
            }}
          >
            <TabBar
              activeKey={activeKey}
              onChange={(value) => {
                if (value !== activeKey) {
                  navigate(value);
                }
              }}
              style={tabBarStyle}
            >
              {tabs.map((tab) => (
                <TabBar.Item
                  key={tab.key}
                  icon={tab.icon}
                  title={tab.title}
                  badge={tab.badge}
                />
              ))}
            </TabBar>
            <SafeArea position="bottom" />
          </div>
        )}
      </div>
    </div>
  );
}
