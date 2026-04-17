'use client';

import { Suspense } from 'react';
import AdminRouteDetailPage from '@/routes/admin/route-detail';

export default function AdminRouteDetailRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminRouteDetailPage />
    </Suspense>
  );
}
