'use client';

import { Suspense } from 'react';
import AdminUsersPage from '@/routes/admin/users';

export default function AdminUsersRoutePage() {
  return (
    <Suspense fallback={null}>
      <AdminUsersPage />
    </Suspense>
  );
}
