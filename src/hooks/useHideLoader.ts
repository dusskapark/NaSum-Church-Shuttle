import { useEffect, useRef } from 'react';

const SAFETY_TIMEOUT_MS = 10000;


function safeHideLoader(): void {
  // Native LINE container loader APIs are not available in LIFF/browser context.
  // Keep this hook as a stable no-op so call sites do not need to change.
}

/**
 * Hides the native LINE MiniApp loader once the app is ready.
 *
 * Native loader API가 없는 브라우저/LIFF 환경에서는 no-op 동작만 유지합니다.
 */
export function useHideLoader(isReady: boolean): void {
  const hideCalledRef = useRef(false);

  // Hide when app signals ready
  useEffect(() => {
    if (isReady && !hideCalledRef.current) {
      hideCalledRef.current = true;
      safeHideLoader();
    }
  }, [isReady]);

  // Safety fallback: always hide after SAFETY_TIMEOUT_MS to prevent stuck screen
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hideCalledRef.current) {
        hideCalledRef.current = true;
        safeHideLoader();
      }
    }, SAFETY_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, []);
}
