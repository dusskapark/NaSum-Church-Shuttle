import { Suspense, useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, Skeleton } from 'antd-mobile';
import enUS from 'antd-mobile/es/locales/en-US';
import koKR from 'antd-mobile/es/locales/ko-KR';
import createAppRouter from './routes';
import { GrabUserProvider } from './hooks/useGrabUser';
import { AppSettingsProvider, useAppSettings } from './lib/app-settings';
import { useAppLoader } from './hooks/useAppLoader';
import './globalStyles.less';
import './styles/inject-duxton-tokens';

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

  return (
    <ConfigProvider locale={lang === 'ko' ? koKR : enUS}>
      <GrabUserProvider>
        <Suspense fallback={<PageSkeleton />}>
          <RouterProvider router={router} />
        </Suspense>
      </GrabUserProvider>
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
