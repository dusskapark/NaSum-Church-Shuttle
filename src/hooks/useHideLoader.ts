import { useEffect, useRef } from 'react';
import { ContainerModule, SplashScreenModule } from '@/shims/superapp-sdk';

const SAFETY_TIMEOUT_MS = 10000;

// Create singleton instances
const containerModule = new ContainerModule();
const splashScreenModule = new SplashScreenModule();

function safeHideLoader(): void {
  try {
    const result = containerModule.hideLoader();
    // hideLoader() may not return a Promise outside the LINE MiniApp context
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }

    // Notify container that content has rendered — separate from loader state
    const loaded = containerModule.onContentLoaded();
    if (loaded && typeof loaded.catch === 'function') {
      loaded.catch(() => {});
    }

    // Dismiss the native Lottie splash screen (lottie.json in /public)
    const dismissed = splashScreenModule.dismiss();
    if (dismissed && typeof dismissed.catch === 'function') {
      dismissed.catch(() => {});
    }
  } catch {
    // Not in LINE MiniApp context — ignore
  }
}

/**
 * Hides the native LINE MiniApp loader once the app is ready.
 *
 * Works together with native loader configuration in the container host.
 *
 * When fullNativeLoader is enabled, the native splash screen stays visible
 * until hideLoader() is called — preventing users from seeing any intermediate
 * loading state (Map "Loading...", skeleton flashes, etc.)
 *
 * Outside the LINE MiniApp context (local dev, browser), hideLoader() is a
 * no-op and errors are silently ignored.
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
