'use client';

import { Suspense } from 'react';
import OAuthCallbackPage from '@/routes/oauth-callback';

export default function OAuthCallbackRoutePage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackPage />
    </Suspense>
  );
}
