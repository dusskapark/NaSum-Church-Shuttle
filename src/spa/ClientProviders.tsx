'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import {
  type ComponentType,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  AppSettingsProvider,
  type AppLanguage,
  type AppTheme,
} from '@/lib/app-settings';
import { queryClient } from '@/lib/queryClient';
import GlobalClientEffects from './GlobalClientEffects';

type ClientProvidersProps = PropsWithChildren<{
  initialLang: AppLanguage;
  initialTheme: AppTheme;
}>;

export default function ClientProviders({
  children,
  initialLang,
  initialTheme,
}: ClientProvidersProps) {
  const [showQueryDevtools, setShowQueryDevtools] = useState(false);
  const [DevtoolsComponent, setDevtoolsComponent] = useState<ComponentType<{
    initialIsOpen?: boolean;
    buttonPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  }> | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const host = window.location.hostname;
    const shouldShow = host === 'localhost' || host === '127.0.0.1';
    setShowQueryDevtools(shouldShow);
    if (!shouldShow) return;

    import('@tanstack/react-query-devtools')
      .then(({ ReactQueryDevtools }) => {
        setDevtoolsComponent(() => ReactQueryDevtools);
      })
      .catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider initialLang={initialLang} initialTheme={initialTheme}>
        <GlobalClientEffects>{children}</GlobalClientEffects>
      </AppSettingsProvider>
      {showQueryDevtools && DevtoolsComponent ? (
        <DevtoolsComponent initialIsOpen={false} buttonPosition="top-right" />
      ) : null}
    </QueryClientProvider>
  );
}
