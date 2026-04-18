'use client';

import { Suspense } from 'react';
import AdminScheduleRouteDetailPage from '@/routes/admin/schedules/route-detail';

export default function AdminScheduleRouteDetailRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminScheduleRouteDetailPage />
    </Suspense>
  );
}
