'use client';

import { Suspense } from 'react';
import AdminRunsPage from '@/routes/admin/runs';

export default function AdminRunsRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminRunsPage />
    </Suspense>
  );
}
