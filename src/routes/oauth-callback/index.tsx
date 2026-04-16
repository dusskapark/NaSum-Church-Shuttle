import { useEffect, useState } from 'react';
import { SpinLoading } from 'antd-mobile';
import ErrorBlockPage from '@/components/ErrorBlockPage';
import { useTranslation } from '@/lib/useTranslation';
import { storeAuthFromBackend } from '../../hooks/useLineUser';

function normalizeReturnToPath(rawPath: string): string {
  if (typeof window === 'undefined') return rawPath;

  try {
    let url = new URL(rawPath, window.location.origin);

    for (let i = 0; i < 4; i += 1) {
      const state = url.searchParams.get('liff.state');
      if (!state) break;

      const decoded = decodeURIComponent(state);
      const nested = decoded.startsWith('?') ? decoded.slice(1) : decoded;

      if (nested.startsWith('liff.state=')) {
        url = new URL(`/?${nested}`, window.location.origin);
        continue;
      }

      url = nested.startsWith('http')
        ? new URL(nested)
        : new URL(nested, window.location.origin);
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return rawPath;
  }
}

export default function OAuthCallbackPage() {
  const t = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        await storeAuthFromBackend();
        const returnTo = normalizeReturnToPath(
          sessionStorage.getItem('line:returnTo') ?? '/',
        );
        sessionStorage.removeItem('line:returnTo');
        window.location.replace(returnTo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    })();
  }, [retryKey]);

  if (error) {
    return (
      <ErrorBlockPage
        status="disconnected"
        title={t('errorPages.authErrorTitle')}
        description={`${t('errorPages.authErrorDescription')}\n${error}`}
        primaryLabel={t('errorPages.retry')}
        secondaryLabel={t('errorPages.goHome')}
        onPrimary={() => {
          setError(null);
          setRetryKey((prev) => prev + 1);
        }}
        onSecondary={() => window.location.replace('/')}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100dvh',
      }}
    >
      <SpinLoading />
    </div>
  );
}
