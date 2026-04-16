import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import 'antd-mobile/es/global';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../src/styles/globals.css';
import '../src/globalStyles.css';
import ClientProviders from '@/spa/ClientProviders';
import {
  normalizeLangCookie,
  normalizeThemeCookie,
  APP_LANG_COOKIE,
  APP_THEME_COOKIE,
} from '@/lib/app-settings-cookies';

export const metadata: Metadata = {
  title: 'NaSum Church Shuttle',
  description: 'LINE LIFF mini app for shuttle route registration and check-in.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const initialLang = normalizeLangCookie(cookieStore.get(APP_LANG_COOKIE)?.value);
  const initialTheme = normalizeThemeCookie(cookieStore.get(APP_THEME_COOKIE)?.value);

  return (
    <html
      lang={initialLang}
      data-prefers-color-scheme={initialTheme === 'dark' ? 'dark' : undefined}
    >
      <body>
        <ClientProviders initialLang={initialLang} initialTheme={initialTheme}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
