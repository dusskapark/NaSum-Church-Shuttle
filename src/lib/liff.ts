'use client';

import type { Liff } from '@line/liff';

let liffPromise: Promise<Liff | null> | null = null;

function getLiffId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.location.hostname === 'localhost') {
    return process.env.NEXT_PUBLIC_LIFF_ID_DEV ?? process.env.NEXT_PUBLIC_LIFF_ID;
  }
  return process.env.NEXT_PUBLIC_LIFF_ID;
}

export async function getLiff(): Promise<Liff | null> {
  if (typeof window === 'undefined') return null;
  if (liffPromise) return liffPromise;

  liffPromise = import('@line/liff')
    .then(async ({ default: liff }) => {
      const liffId = getLiffId();
      if (!liffId) return null;
      if (!liff.isInitialized()) {
        await liff.init({ liffId });
      }
      return liff;
    })
    .catch(() => null);

  return liffPromise;
}
