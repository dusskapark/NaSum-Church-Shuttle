import { useState } from 'react'
import Head from 'next/head'
import { Avatar, List, Picker, Skeleton, Switch } from 'antd-mobile'
import { useRouter } from 'next/router'
import packageJson from '../package.json'
import Layout from '../components/Layout'
import { useHydrated } from '../hooks/useHydrated'
import { useRegistration } from '../hooks/useRegistration'
import { useLiff } from '../hooks/useLiff'
import { useAppSettings, type AppLanguage } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import { getRouteLabel } from '../lib/routeSelectors'

const PUSH_PREF_KEY = 'nasum:push-notifications-enabled'

export default function SettingsPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const { user, loading: liffLoading } = useLiff()
  const { lang, setLang, isDark, toggleTheme } = useAppSettings()
  const copy = getCopy(lang)
  const { registration, loading: registrationLoading } = useRegistration(
    user?.userId ?? null,
    copy.common.serverError
  )

  const [pushEnabledOverride, setPushEnabledOverride] = useState<boolean | null>(null)
  const [pickerVisible, setPickerVisible] = useState(false)


  const langLabel = lang === 'ko' ? copy.settings.languageKorean : copy.settings.languageEnglish
  const pushEnabled =
    pushEnabledOverride ??
    (hydrated
      ? (() => {
          const storedValue = window.localStorage.getItem(PUSH_PREF_KEY)
          return storedValue === null ? true : storedValue === 'true'
        })()
      : true)
  const lineVersion = hydrated
    ? window.navigator.userAgent.match(/Line\/([\d.]+)/i)?.[1] ?? 'Unknown'
    : 'Unknown'

  const isLoading = liffLoading || registrationLoading

  const listStyle = {
    '--border-radius': '12px',
    background: 'var(--app-color-surface)',
    overflow: 'hidden' as const,
  }

  return (
    <>
      <Head>
        <title>{copy.settings.title}</title>
      </Head>
      <Layout>
        <List header={copy.settings.profileHeader} style={listStyle}>
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

        <List header={copy.settings.routeHeader} style={listStyle}>
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
                    {registration ? getRouteLabel(registration.route) : copy.settings.noRouteSelected}
                  </span>
                }
              >
                {copy.settings.currentRoute}
              </List.Item>
              <List.Item
                extra={
                  <span style={{ color: 'var(--app-color-subtle-text)' }}>
                    {registration ? (registration.route_stop.place.display_name ?? registration.route_stop.place.name) : '-'}
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

        <List header={copy.settings.preferencesHeader} style={listStyle}>
          <List.Item
            extra={
              <Switch
                checked={pushEnabled}
                onChange={checked => {
                  setPushEnabledOverride(checked)

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

        <List header={copy.settings.themeHeader} style={listStyle}>
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
                onChange={checked => {
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

        <List header={copy.settings.versionHeader} style={listStyle}>
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


        {/* 하단 탭바 여백 */}
        <div style={{ height: 'calc(var(--app-tab-bar-height) + env(safe-area-inset-bottom, 0px) + 16px)' }} />

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
      </Layout>
    </>
  )
}
