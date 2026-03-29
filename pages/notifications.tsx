import { NavBar } from 'antd-mobile'
import { useRouter } from 'next/router'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import AppTabBar, { APP_TAB_BAR_SAFE_OFFSET } from './components/AppTabBar'

export default function NotificationsPage() {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)

  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingBottom: APP_TAB_BAR_SAFE_OFFSET,
        background: 'var(--adm-color-background)',
      }}
    >
      <NavBar onBack={() => router.push('/')}>{copy.notifications.title}</NavBar>

      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: 'calc(100dvh - 45px - 64px - env(safe-area-inset-bottom))',
          padding: 24,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 24,
            borderRadius: 24,
            background: 'var(--app-color-surface)',
            boxShadow: 'var(--app-shadow-raised)',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--app-color-title)' }}>
            {copy.notifications.title}
          </div>
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: 'var(--app-color-subtle-text)' }}>
            {copy.notifications.description}
          </div>
        </div>
      </div>

      <AppTabBar />
    </div>
  )
}
