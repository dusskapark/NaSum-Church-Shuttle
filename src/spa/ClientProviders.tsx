'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ConfigProvider, unstableSetRender } from 'antd-mobile';
import enUS from 'antd-mobile/es/locales/en-US';
import koKR from 'antd-mobile/es/locales/ko-KR';
import {
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LineUserProvider } from '@/hooks/useLineUser';
import { useAppLoader } from '@/hooks/useAppLoader';
import {
  AppSettingsProvider,
  type AppLanguage,
  type AppTheme,
  useAppSettings,
} from '@/lib/app-settings';
import { queryClient } from '@/lib/queryClient';
import { injectDesignTokens } from '@/styles/inject-duxton-tokens';

const antdMobileRoots = new WeakMap<Element | DocumentFragment, Root>();

function AppShell({ children }: PropsWithChildren) {
  const { lang } = useAppSettings();

  useAppLoader();

  useEffect(() => {
    injectDesignTokens();
    unstableSetRender((node, container) => {
      const existingRoot = antdMobileRoots.get(container);
      const root = existingRoot ?? createRoot(container);
      antdMobileRoots.set(container, root);
      root.render(node);

      return async () => {
        root.unmount();
        antdMobileRoots.delete(container);
      };
    });

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message = reason instanceof Error ? reason.message : String(reason);

      if (message === 'Load failed') {
        console.warn(
          '[unhandledrejection] fetch failed (non-fatal, likely map tile resource)',
          message,
        );
        event.preventDefault();
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.error('[unhandledrejection]', {
          message,
          stack: reason instanceof Error ? reason.stack : undefined,
          reason,
        });
      }
    };

    const onResourceError = (event: Event) => {
      if (process.env.NODE_ENV !== 'development') return;

      const target = event.target as HTMLElement | null;
      if (!target || target === (window as unknown as HTMLElement)) return;

      const url =
        (target as HTMLImageElement).src ||
        (target as HTMLScriptElement).src ||
        (target as HTMLLinkElement).href ||
        target.tagName;

      console.error('[load-error] Resource failed to load', {
        tag: target.tagName,
        url,
      });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onResourceError, true);

    if (process.env.NODE_ENV === 'development') {
      import('eruda')
        .then(({ default: eruda }) => eruda.init())
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onResourceError, true);
    };
  }, []);

  return (
    <ConfigProvider locale={lang === 'ko' ? koKR : enUS}>
      <LineUserProvider>{children}</LineUserProvider>
    </ConfigProvider>
  );
}

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

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const host = window.location.hostname;
    setShowQueryDevtools(host === 'localhost' || host === '127.0.0.1');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider initialLang={initialLang} initialTheme={initialTheme}>
        <AppShell>{children}</AppShell>
      </AppSettingsProvider>
      {showQueryDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
      ) : null}
    </QueryClientProvider>
  );
}
