import { useEffect, useState } from 'react';
import { SpinLoading } from 'antd-mobile';
import { storeAuthFromBackend } from '../../hooks/useGrabUser';

export default function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await storeAuthFromBackend();
        const returnTo = sessionStorage.getItem('grab:returnTo') ?? '/';
        sessionStorage.removeItem('grab:returnTo');
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
