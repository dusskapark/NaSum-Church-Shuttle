import { useEffect, useMemo, useState } from 'react'
import { Avatar, List, NavBar, Picker, Skeleton, Switch, Toast } from 'antd-mobile'
import { useRouter } from 'next/router'
import packageJson from '../package.json'
import { useLiff } from '../hooks/useLiff'
import { useAppSettings, type AppLanguage } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import type { Nullable, RegisteredUserResponse, RegistrationWithRelations } from '../lib/types'
import AppTabBar, { APP_TAB_BAR_SAFE_OFFSET } from './components/AppTabBar'

const PUSH_PREF_KEY = 'nasum:push-notifications-enabled'

function getRouteLabel(registration: RegistrationWithRelations): string {
  return `${registration.route.line} LINE (${registration.route.service})`
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: liffLoading } = useLiff()
  const { lang, setLang, isDark, toggleTheme } = useAppSettings()
  const copy = getCopy(lang)

  const [registration, setRegistration] = useState<Nullable<RegistrationWithRelations>>(null)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(true)
  const [pickerVisible, setPickerVisible] = useState(false)

  const langLabel = lang === 'ko' ? copy.settings.languageKorean : copy.settings.languageEnglish
  const lineVersion = useMemo(() => {
    if (typeof window === 'undefined') return 'Unknown'

    const match = window.navigator.userAgent.match(/Line\/([\d.]+)/i)
    return match?.[1] ?? 'Unknown'
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedValue = window.localStorage.getItem(PUSH_PREF_KEY)
    setPushEnabled(storedValue === null ? true : storedValue === 'true')
  }, [])

  useEffect(() => {
    if (!user) return

    void (async () => {
      setRegistrationLoading(true)

      try {
        const response = await fetch(
          `/api/v1/user-registration?provider=line&provider_uid=${encodeURIComponent(user.userId)}`
        )
        const data = (await response.json()) as RegisteredUserResponse
        setRegistration(data.registration ?? null)
      } catch {
        Toast.show({ content: copy.common.serverError, icon: 'fail' })
      } finally {
        setRegistrationLoading(false)
      }
    })()
  }, [copy.common.serverError, user])

  const isLoading = liffLoading || registrationLoading

  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingBottom: APP_TAB_BAR_SAFE_OFFSET,
        background: 'var(--adm-color-background)',
      }}
    >
      <NavBar onBack={() => router.back()}>{copy.settings.title}</NavBar>

      <List header={copy.settings.profileHeader}>
        <List.Item
          prefix={
            <Avatar
              src={user?.pictureUrl ?? ''}
              fallback={user?.displayName?.charAt(0).toUpperCase() ?? 'N'}
              style={{ '--size': '40px', '--border-radius': '50%' }}
            />
          }
        >
          {user?.displayName ?? copy.common.loadingUserName}
        </List.Item>
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)' }}>
              {user?.displayName ?? copy.common.loadingUserName}
            </span>
          }
        >
          {copy.settings.displayName}
        </List.Item>
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)', fontSize: 12 }}>
              {user?.userId ?? '-'}
            </span>
          }
        >
          {copy.settings.userId}
        </List.Item>
      </List>

      <List header={copy.settings.routeHeader}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton.Title animated />
            <Skeleton.Paragraph lineCount={3} animated />
          </div>
        ) : (
          <>
            <List.Item
              extra={
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {registration ? getRouteLabel(registration) : copy.settings.noRouteSelected}
                </span>
              }
            >
              {copy.settings.currentRoute}
            </List.Item>
            <List.Item
              extra={
                <span style={{ color: 'var(--app-color-subtle-text)' }}>
                  {registration?.station.name ?? '-'}
                </span>
              }
            >
              {copy.settings.currentStop}
            </List.Item>
            <List.Item
              clickable
              onClick={() => {
                void router.push('/search')
              }}
            >
              {copy.settings.changeRoute}
            </List.Item>
          </>
        )}
      </List>

      <List header={copy.settings.preferencesHeader}>
        <List.Item
          extra={
            <Switch
              checked={pushEnabled}
              onChange={(checked) => {
                setPushEnabled(checked)
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem(PUSH_PREF_KEY, String(checked))
                }
              }}
            />
          }
          description={copy.settings.pushNotificationsHint}
        >
          {copy.settings.pushNotifications}
        </List.Item>
      </List>

      <List header={copy.settings.themeHeader}>
        <List.Item
          extra={<span style={{ color: 'var(--app-color-subtle-text)' }}>{langLabel}</span>}
          onClick={() => {
            setPickerVisible(true)
          }}
        >
          {copy.settings.language}
        </List.Item>
        <List.Item
          extra={
            <Switch
              checked={isDark}
              onChange={(checked) => {
                if (checked !== isDark) {
                  toggleTheme()
                }
              }}
            />
          }
        >
          {copy.settings.darkMode}
        </List.Item>
      </List>

      <List header={copy.settings.versionHeader}>
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)' }}>
              {packageJson.dependencies['antd-mobile']}
            </span>
          }
        >
          {copy.settings.antdMobileVersion}
        </List.Item>
        <List.Item
          extra={
            <span style={{ color: 'var(--app-color-subtle-text)' }}>
              {packageJson.dependencies['@line/liff']}
            </span>
          }
        >
          {copy.settings.liffSdkVersion}
        </List.Item>
        <List.Item extra={<span style={{ color: 'var(--app-color-subtle-text)' }}>{lineVersion}</span>}>
          {copy.settings.lineVersion}
        </List.Item>
      </List>

      <Picker
        columns={[
          [
            { label: copy.settings.languageEnglish, value: 'en' },
            { label: copy.settings.languageKorean, value: 'ko' },
          ],
        ]}
        visible={pickerVisible}
        onClose={() => {
          setPickerVisible(false)
        }}
        value={[lang]}
        onConfirm={value => {
          const nextLanguage = value[0]

          if (nextLanguage === 'en' || nextLanguage === 'ko') {
            setLang(nextLanguage as AppLanguage)
          }
        }}
      />

      <AppTabBar />
    </div>
  )
}
