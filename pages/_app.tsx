import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import 'maplibre-gl/dist/maplibre-gl.css'
import 'antd-mobile/es/global'
import '../styles/globals.css'

import { ConfigProvider } from 'antd-mobile'
import enUS from 'antd-mobile/es/locales/en-US'
import koKR from 'antd-mobile/es/locales/ko-KR'
import { AppSettingsProvider, useAppSettings } from '../lib/app-settings'
import { initGlobalErrorHandler } from '../lib/errorHandler'
import { LiffProvider } from '../hooks/useLiff'

function AppContent({ Component, pageProps }: AppProps) {
  const { lang } = useAppSettings()

  // 글로벌 에러 핸들러 초기화 (클라이언트에서만)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initGlobalErrorHandler()
    }
  }, [])

  return (
    <ConfigProvider locale={lang === 'ko' ? koKR : enUS}>
      <Component {...pageProps} />
    </ConfigProvider>
  )
}

export default function App(props: AppProps) {
  return (
    <AppSettingsProvider>
      <LiffProvider>
        <AppContent {...props} />
      </LiffProvider>
    </AppSettingsProvider>
  )
}
