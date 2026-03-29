import { useEffect, useState } from 'react'
import { Avatar, List, NavBar, Skeleton, Switch, Toast } from 'antd-mobile'
import { useRouter } from 'next/router'
import { useLiff } from '../hooks/useLiff'
import { getCopy } from '../lib/copy'
import type { Nullable, RegisteredUserResponse, RegistrationWithRelations } from '../lib/types'

const PUSH_PREF_KEY = 'nasum:push-notifications-enabled'

function getRouteLabel(registration: RegistrationWithRelations): string {
  return `${registration.route.line} LINE (${registration.route.service})`
}

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: liffLoading } = useLiff()
  const copy = getCopy('en')

  const [registration, setRegistration] = useState<Nullable<RegistrationWithRelations>>(null)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(true)

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
    <div style={{ minHeight: '100dvh', background: '#fff' }}>
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
          extra={<span style={{ color: '#888' }}>{user?.displayName ?? copy.common.loadingUserName}</span>}
        >
          {copy.settings.displayName}
        </List.Item>
        <List.Item extra={<span style={{ color: '#888', fontSize: 12 }}>{user?.userId ?? '-'}</span>}>
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
              extra={<span style={{ color: '#888' }}>{registration ? getRouteLabel(registration) : copy.settings.noRouteSelected}</span>}
            >
              {copy.settings.currentRoute}
            </List.Item>
            <List.Item
              extra={<span style={{ color: '#888' }}>{registration?.station.name ?? '-'}</span>}
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

      <List header={copy.settings.aboutHeader}>
        <List.Item extra={<span style={{ color: '#888' }}>nasumchurch@gmail.com</span>}>
          {copy.settings.email}
        </List.Item>
        <List.Item extra={<span style={{ color: '#888' }}>65-6467-4476</span>}>
          {copy.settings.phone}
        </List.Item>
        <List.Item
          extra={
            <span style={{ color: '#888', textAlign: 'right', whiteSpace: 'normal' }}>
              12 Shelford Road Singapore 288370
            </span>
          }
        >
          {copy.settings.address}
        </List.Item>
      </List>
    </div>
  )
}
