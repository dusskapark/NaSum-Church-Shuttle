import { useEffect, useState } from 'react';
import { SpinLoading } from 'antd-mobile';
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
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  if (error) {
    return <div style={{ padding: 24, color: 'red' }}>{error}</div>;
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
