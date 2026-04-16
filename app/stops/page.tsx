'use client';

import { Suspense } from 'react';
import StopsPage from '@/routes/stops';

export default function StopsRoutePage() {
  return (
    <Suspense fallback={null}>
      <StopsPage />
    </Suspense>
  );
}
