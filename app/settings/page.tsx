'use client';

import { Suspense } from 'react';
import 'antd-mobile/es/global';
import SettingsPage from '@/routes/settings';

export default function SettingsRoutePage() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
