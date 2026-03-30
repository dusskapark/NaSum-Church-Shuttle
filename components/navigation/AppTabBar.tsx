import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { Badge, SafeArea, TabBar } from 'antd-mobile'
import {
  BellOutline,
  CompassOutline,
  SearchOutline,
  SetOutline,
  ScanningOutline,
} from 'antd-mobile-icons'
import { useRouter } from 'next/router'
import { useAppSettings } from '../../lib/app-settings'
import { getCopy } from '../../lib/copy'

export const APP_TAB_BAR_HEIGHT = 64
export const APP_SAFE_AREA_INSET_BOTTOM = 'env(safe-area-inset-bottom, 0px)'
export const APP_TAB_BAR_SAFE_OFFSET = `calc(${APP_TAB_BAR_HEIGHT}px + ${APP_SAFE_AREA_INSET_BOTTOM})`

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
    <Badge
      content={
        <span
          style={{
            display: 'block',
            width: 8,
            height: 8,
            borderRadius: 999,
            background: 'var(--adm-color-warning)',
            boxShadow: '0 0 0 2px var(--adm-color-background)',
          }}
        />
      }
      style={{
        '--right': '-2px',
        '--top': '2px',
      }}
    >
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
    </Badge>
  )
}

export default function AppTabBar() {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)

  const activeKey = useMemo(() => {
    if (router.pathname === '/search' || router.pathname === '/search-map') return '/search'
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

  const tabBarStyle: CSSProperties & Record<'--adm-color-primary', string> = {
    '--adm-color-primary': 'var(--app-color-link)',
    height: APP_TAB_BAR_HEIGHT,
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        left: 0,
        paddingBottom: APP_SAFE_AREA_INSET_BOTTOM,
        zIndex: 40,
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
      <SafeArea position='bottom' />
    </div>
  )
}
