'use client';

import { useRouter } from 'next/navigation';
import ErrorBlockPage from '@/components/ErrorBlockPage';
import { useTranslation } from '@/lib/useTranslation';

export default function NotFound() {
  const router = useRouter();
  const t = useTranslation();

  return (
    <ErrorBlockPage
      status="empty"
      title={t('errorPages.notFoundTitle')}
      description={t('errorPages.notFoundDescription')}
      primaryLabel={t('errorPages.goHome')}
      secondaryLabel={t('errorPages.goBack')}
      onPrimary={() => router.replace('/')}
      onSecondary={() => router.back()}
    />
  );
}
