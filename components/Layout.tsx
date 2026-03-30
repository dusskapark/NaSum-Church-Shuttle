import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { useRouter } from 'next/router'
import { SafeArea, TabBar } from 'antd-mobile'
import {
  BellOutline,
  CompassOutline,
  SearchOutline,
  SetOutline,
  ScanningOutline,
} from 'antd-mobile-icons'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import LiffBanner from './LiffBanner'

interface LayoutProps {
  children: ReactNode
  style?: CSSProperties
  showTabBar?: boolean
  withSafeArea?: boolean
}

type TabItem = {
  key: string
  title: string
  icon: ReactNode
}

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
  )
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
  )
}

export default function Layout({
  children,
  style,
  showTabBar = true,
  withSafeArea = true,
}: LayoutProps) {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)

  const activeKey = useMemo(() => {
    if (router.pathname === '/search') return '/search'
    if (router.pathname === '/scan') return '/scan'
    if (router.pathname === '/notifications') return '/notifications'
    if (router.pathname === '/settings') return '/settings'
    return '/'
  }, [router.pathname])

  const tabs = useMemo<TabItem[]>(
    () => [
      {
        key: '/',
        title: copy.tabs.home,
        icon: <HomeTabIcon active={activeKey === '/'} />,
      },
      {
        key: '/search',
        title: copy.tabs.stops,
        icon: <SearchOutline fontSize={22} />,
      },
      {
        key: '/scan',
        title: copy.tabs.scan,
        icon: <ScanTabIcon active={activeKey === '/scan'} />,
      },
      {
        key: '/notifications',
        title: copy.tabs.notifications,
        icon: <BellOutline fontSize={22} />,
      },
      {
        key: '/settings',
        title: copy.tabs.settings,
        icon: <SetOutline fontSize={22} />,
      },
    ],
    [activeKey, copy.tabs.home, copy.tabs.notifications, copy.tabs.scan, copy.tabs.settings, copy.tabs.stops]
  )

  const baseStyle: CSSProperties = {
    height: '100dvh',
    background: 'var(--adm-color-background)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  }

  const tabBarStyle: CSSProperties & Record<'--adm-color-primary', string> = {
    '--adm-color-primary': 'var(--app-color-link)',
    height: 'var(--app-tab-bar-height)',
  }

  return (
    <div style={{ ...baseStyle, ...style }}>
      {withSafeArea && <SafeArea position="top" />}

      <div style={{ display: 'contents' }}>
        <LiffBanner />
        <div style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
        {showTabBar && (
          <div
            style={{
              flex: 'none',
              height: 'calc(var(--app-tab-bar-height) + env(safe-area-inset-bottom, 0px))',
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
              zIndex: 'var(--z-tabbar)',
              background: 'var(--adm-color-background)',
              boxShadow: 'var(--app-shadow-toolbar)',
              borderTop: '1px solid var(--app-color-border)',
            }}
          >
            <TabBar
              activeKey={activeKey}
              onChange={value => {
                if (value !== activeKey) {
                  void router.push(value)
                }
              }}
              style={tabBarStyle}
            >
              {tabs.map(tab => (
                <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
              ))}
            </TabBar>
            <SafeArea position="bottom" />
          </div>
        )}
      </div>
    </div>
  )
}
