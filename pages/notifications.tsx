import Head from 'next/head'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'

export default function NotificationsPage() {
  const router = useRouter()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)

  return (
    <>
      <Head>
        <title>{copy.notifications.title}</title>
      </Head>
      <Layout>
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: 'calc(var(--app-content-height) - 45px)',
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
    </Layout>
    </>
  )
}
