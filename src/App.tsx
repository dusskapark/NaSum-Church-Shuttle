import { Suspense, useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, Skeleton, unstableSetRender } from 'antd-mobile';
import { createRoot, type Root } from 'react-dom/client';
import enUS from 'antd-mobile/es/locales/en-US';
import koKR from 'antd-mobile/es/locales/ko-KR';
import createAppRouter from './routes';
import { LineUserProvider } from './hooks/useLineUser';
import { AppSettingsProvider, useAppSettings } from './lib/app-settings';
import { useAppLoader } from './hooks/useAppLoader';
import './globalStyles.css';
import { injectDesignTokens } from './styles/inject-duxton-tokens';

const antdMobileRoots = new WeakMap<Element | DocumentFragment, Root>();

function PageSkeleton() {
  return (
    <div style={{ padding: '16px 16px 0' }}>
      <Skeleton.Title animated />
      <Skeleton.Paragraph lineCount={8} animated />
    </div>
  );
}

function AppContent() {
  const router = useMemo(() => createAppRouter(), []);
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
  }, []);

  return (
    <ConfigProvider locale={lang === 'ko' ? koKR : enUS}>
      <LineUserProvider>
        <Suspense fallback={<PageSkeleton />}>
          <RouterProvider
            future={{ v7_startTransition: true }}
            router={router}
          />
        </Suspense>
      </LineUserProvider>
    </ConfigProvider>
  );
}

const App = () => {
  return (
    <AppSettingsProvider>
      <AppContent />
    </AppSettingsProvider>
  );
};

export default App;
