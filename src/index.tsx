import 'antd-mobile/es/global';
import './styles/globals.css';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import App from './App';

// Safari/WebKit rejects with "Load failed" when a fetch (e.g. map tile sprite)
// fails in all environments. Suppress these non-fatal resource load errors.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as unknown;
  const message = reason instanceof Error ? reason.message : String(reason);

  if (message === 'Load failed') {
    console.warn(
      '[unhandledrejection] fetch failed (non-fatal, likely map tile resource)',
      message,
    );
    event.preventDefault();
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[unhandledrejection]', {
      message,
      stack: reason instanceof Error ? reason.stack : undefined,
      reason,
    });
  }
});

if (process.env.NODE_ENV === 'development') {
  import('eruda').then(({ default: eruda }) => eruda.init());

  // Resource load failures (img, script, link) — captures the src/href URL
  window.addEventListener(
    'error',
    (event) => {
      const target = event.target as HTMLElement | null;
      if (target && target !== (window as unknown as HTMLElement)) {
        const url =
          (target as HTMLImageElement).src ||
          (target as HTMLScriptElement).src ||
          (target as HTMLLinkElement).href ||
          target.tagName;
        console.error('[load-error] Resource failed to load', {
          tag: target.tagName,
          url,
          message: event.message,
        });
      }
    },
    true /* capture phase — required for resource errors */,
  );
}

// authorize() → reloadScopes() is handled in useLineUser — no pre-render scope loading needed
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-right" />
    </QueryClientProvider>,
  );
}
