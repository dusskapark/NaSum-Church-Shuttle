'use client';

import { useEffect } from 'react';
import 'antd-mobile/es/global';
import ErrorBlockPage from '@/components/ErrorBlockPage';
import { logError } from '@/lib/logger';
import { useClientTranslation } from '@/lib/useClientTranslation';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lang, t } = useClientTranslation();

  useEffect(() => {
    logError('[global-error]', error);
  }, [error]);

  return (
    <html lang={lang}>
      <body>
        <ErrorBlockPage
          status="busy"
          title={t('errorPages.criticalTitle')}
          description={t('errorPages.criticalDescription')}
          primaryLabel={t('errorPages.retry')}
          secondaryLabel={t('errorPages.refresh')}
          onPrimary={() => reset()}
          onSecondary={() => window.location.reload()}
        />
      </body>
    </html>
  );
}
