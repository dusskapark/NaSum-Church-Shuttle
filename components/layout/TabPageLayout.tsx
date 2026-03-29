import type { CSSProperties, ReactNode } from 'react'
import AppTabBar, { APP_TAB_BAR_SAFE_OFFSET } from '../navigation/AppTabBar'

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
    ...(withSafeAreaPadding ? { paddingBottom: APP_TAB_BAR_SAFE_OFFSET } : {}),
  }

  return (
    <div style={{ ...baseStyle, ...style }}>
      {children}
      {showTabBar ? <AppTabBar /> : null}
    </div>
  )
}
