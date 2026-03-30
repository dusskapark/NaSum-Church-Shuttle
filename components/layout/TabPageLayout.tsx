import type { CSSProperties, ReactNode } from 'react'
import { SafeArea } from 'antd-mobile'
import AppTabBar, { APP_TAB_BAR_HEIGHT } from '../navigation/AppTabBar'

interface TabPageLayoutProps {
  children: ReactNode
  style?: CSSProperties
  showTabBar?: boolean
  withSafeAreaPadding?: boolean
}

export default function TabPageLayout({
  children,
  style,
  showTabBar = true,
  withSafeAreaPadding = true,
}: TabPageLayoutProps) {
  const baseStyle: CSSProperties = {
    minHeight: '100dvh',
    background: 'var(--adm-color-background)',
  }

  return (
    <div style={{ ...baseStyle, ...style }}>
      {children}
      {showTabBar && withSafeAreaPadding ? (
        <>
          <div style={{ height: APP_TAB_BAR_HEIGHT }} />
          <SafeArea position='bottom' />
        </>
      ) : null}
      {showTabBar ? <AppTabBar /> : null}
    </div>
  )
}
