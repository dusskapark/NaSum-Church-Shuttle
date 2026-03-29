import 'maplibre-gl/dist/maplibre-gl.css'
import 'antd-mobile/es/global'
import '../styles/globals.css'

import { ConfigProvider } from 'antd-mobile'
import koKR from 'antd-mobile/es/locales/ko-KR'

export default function App({ Component, pageProps }) {
  return (
    <ConfigProvider locale={koKR}>
      <Component {...pageProps} />
    </ConfigProvider>
  )
}
