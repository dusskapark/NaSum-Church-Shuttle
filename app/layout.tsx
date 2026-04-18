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
