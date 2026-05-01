import type { Metadata } from 'next';
import 'antd-mobile/es/global';
import '../src/styles/globals.css';
import '../src/globalStyles.css';
import ClientProviders from '@/spa/ClientProviders';
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_APP_THEME,
} from '@/lib/app-settings-cookies';

export const metadata: Metadata = {
  title: 'NaSum Church Shuttle',
  description: 'LINE LIFF mini app for shuttle route registration and check-in.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: [{ url: '/favicon.ico' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang={DEFAULT_APP_LANGUAGE}
      suppressHydrationWarning
    >
      <body>
        <ClientProviders
          initialLang={DEFAULT_APP_LANGUAGE}
          initialTheme={DEFAULT_APP_THEME}
        >
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
