'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ErrorBlockPage from '@/components/ErrorBlockPage';
import { useTranslation } from '@/lib/useTranslation';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const t = useTranslation();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorBlockPage
      status="disconnected"
      title={t('errorPages.appErrorTitle')}
      description={t('errorPages.appErrorDescription')}
      primaryLabel={t('errorPages.retry')}
      secondaryLabel={t('errorPages.goHome')}
      onPrimary={() => reset()}
      onSecondary={() => router.replace('/')}
    />
  );
}
