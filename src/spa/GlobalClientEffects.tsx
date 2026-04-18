'use client';

import { ConfigProvider, unstableSetRender } from 'antd-mobile';
import enUS from 'antd-mobile/es/locales/en-US';
import koKR from 'antd-mobile/es/locales/ko-KR';
import { useEffect, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LineUserProvider } from '@/hooks/useLineUser';
import { useAppLoader } from '@/hooks/useAppLoader';
import { logDebug, logDevError } from '@/lib/logger';
import { useAppSettings } from '@/lib/app-settings';
import { injectDesignTokens } from '@/styles/inject-duxton-tokens';

const antdMobileRoots = new WeakMap<Element | DocumentFragment, Root>();

function GlobalErrorBoundaryEffects() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const message = reason instanceof Error ? reason.message : String(reason);

      if (message === 'Load failed') {
        logDebug(
          '[unhandledrejection] fetch failed (non-fatal, likely map tile resource)',
          message,
        );
        event.preventDefault();
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        logDevError('[unhandledrejection]', {
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

      logDevError('[load-error] Resource failed to load', {
        tag: target.tagName,
        url,
      });
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onResourceError, true);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onResourceError, true);
    };
  }, []);

  return null;
}

export default function GlobalClientEffects({ children }: PropsWithChildren) {
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

    if (process.env.NODE_ENV === 'development') {
      import('eruda')
        .then(({ default: eruda }) => eruda.init())
        .catch(() => {});
    }
  }, []);

  return (
    <ConfigProvider locale={lang === 'ko' ? koKR : enUS}>
      <GlobalErrorBoundaryEffects />
      <LineUserProvider>{children}</LineUserProvider>
    </ConfigProvider>
  );
}
