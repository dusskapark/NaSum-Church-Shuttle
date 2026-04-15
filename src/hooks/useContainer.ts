import { useEffect, useState } from 'react';
import { useAppSettings } from '../lib/app-settings';
import {
  ContainerModule,
  isSuccess,
  isError,
  isNoContent,
} from '@/shims/superapp-sdk';

// Create singleton instance
const containerModule = new ContainerModule();

export function useContainer(initialTitle?: string) {
  const [title, setTitle] = useState<string | undefined>(initialTitle);
  const [sessionParams, setSessionParams] = useState<Record<
    string,
    any
  > | null>(null);
  const [sessionParamsLoading, setSessionParamsLoading] = useState(true);

  const { isDark } = useAppSettings();

  // Set initial title on mount or when initialTitle changes
  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  // Set initial container setup (back button, background color) and fetch session params
  useEffect(() => {
    async function setupContainer() {
      try {
        await containerModule.showBackButton();
        await containerModule.showRefreshButton();

        // Set background color based on theme using design tokens
        const bgColor = isDark ? '#0d1117' : '#f6f8fa';
        await containerModule.setBackgroundColor(bgColor);

        // Get session parameters (SDK 2.0.0-beta.31 format)
        const paramsResult = await containerModule.getSessionParams();

        if (isSuccess(paramsResult)) {
          // Status 200: result should be a JSON string, but SDK may return undefined
          const raw = paramsResult.result;
          if (raw == null) {
            console.debug(
              '[Container] session params result is empty (200 but no data)',
            );
            setSessionParams(null);
          } else {
            try {
              const parsedParams =
                typeof raw === 'string' ? JSON.parse(raw) : raw;
              console.debug('[Container] parsed session params:', parsedParams);
              setSessionParams(parsedParams);
            } catch (parseErr) {
              console.warn(
                '[Container] Failed to parse session params JSON:',
                parseErr,
              );
              setSessionParams(null);
            }
          }
        } else if (isNoContent(paramsResult)) {
          // Status 204: No session parameters available
          console.debug('[Container] No session params available (204)');
          setSessionParams(null);
        } else if (isError(paramsResult)) {
          // Status 500/501: Error occurred
          console.warn(
            '[Container] getSessionParams error:',
            paramsResult.error,
          );
          setSessionParams(null);
        } else {
          console.warn(
            '[Container] Unexpected getSessionParams response:',
            paramsResult,
          );
          setSessionParams(null);
        }
      } catch (error) {
        console.warn('[Container] setup failed:', error);
      } finally {
        // Always mark sessionParams loading as complete, even if failed
        setSessionParamsLoading(false);
      }
    }

    setupContainer();
  }, [isDark]);

  // Title setting effect
  useEffect(() => {
    if (title) {
      document.title = title;
      containerModule.setTitle(title).catch(() => {});
    }
  }, [title]);

  return { setTitle, sessionParams, sessionParamsLoading };
}
