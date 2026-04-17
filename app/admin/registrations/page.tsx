'use client';

import { Suspense } from 'react';
import AdminRegistrationsPage from '@/routes/admin/registrations';

export default function AdminRegistrationsRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminRegistrationsPage />
    </Suspense>
  );
}
