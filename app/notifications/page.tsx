'use client';

import { Suspense } from 'react';
import NotificationsPage from '@/routes/notifications';

export default function NotificationsRoutePage() {
  return (
    <Suspense fallback={null}>
      <NotificationsPage />
    </Suspense>
  );
}
