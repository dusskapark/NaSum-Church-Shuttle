import type { AppProps } from 'next/app'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'antd-mobile/es/global'
import '../styles/globals.css'

import { ConfigProvider } from 'antd-mobile'
import enUS from 'antd-mobile/es/locales/en-US'
import koKR from 'antd-mobile/es/locales/ko-KR'
import { AppSettingsProvider, useAppSettings } from '../lib/app-settings'

function AppContent({ Component, pageProps }: AppProps) {
  const { lang } = useAppSettings()

  return (
    <ConfigProvider locale={lang === 'ko' ? koKR : enUS}>
      <Component {...pageProps} />
    </ConfigProvider>
  )
}

export default function App(props: AppProps) {
  return (
    <AppSettingsProvider>
      <AppContent {...props} />
    </AppSettingsProvider>
  )
}
