'use client';

import { Suspense } from 'react';
import SearchPage from '@/routes/search';

export default function SearchRoutePage() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
