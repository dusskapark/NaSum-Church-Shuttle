'use client';

import { Suspense } from 'react';
import ScanPage from '@/routes/scan';

export default function ScanRoutePage() {
  return (
    <Suspense fallback={null}>
      <ScanPage />
    </Suspense>
  );
}
