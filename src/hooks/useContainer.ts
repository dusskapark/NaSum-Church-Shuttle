import { useEffect, useState } from 'react';
import { useAppSettings } from '../lib/app-settings';
import { logWarn } from '../lib/logger';

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
        // Set background color based on theme using design tokens
        const bgColor = isDark ? '#0d1117' : '#f6f8fa';
        document.documentElement.style.backgroundColor = bgColor;

      const params = Object.fromEntries(
          new URLSearchParams(window.location.search),
        );
        setSessionParams(Object.keys(params).length > 0 ? params : null);
      } catch (error) {
        logWarn('[Container] setup failed:', error);
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
    }
  }, [title]);

  return { setTitle, sessionParams, sessionParamsLoading };
}
