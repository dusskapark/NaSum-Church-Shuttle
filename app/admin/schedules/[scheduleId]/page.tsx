'use client';

import { Suspense } from 'react';
import AdminScheduleDetailPage from '@/routes/admin/schedules';

export default function AdminScheduleDetailRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminScheduleDetailPage />
    </Suspense>
  );
}
