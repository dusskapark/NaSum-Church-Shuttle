'use client';

import { Suspense } from 'react';
import AdminPage from '@/routes/admin';

export default function AdminRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  );
}
