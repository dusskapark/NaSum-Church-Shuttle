'use client';

import { Suspense } from 'react';
import AdminRoutesListPage from '@/routes/admin/routes-list';

export default function AdminRoutesRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminRoutesListPage />
    </Suspense>
  );
}
