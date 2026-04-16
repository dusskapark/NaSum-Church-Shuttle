'use client';

import { Suspense } from 'react';
import ShuttleHome from '@/routes/home';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <ShuttleHome />
    </Suspense>
  );
}
