export const LOCAL_API_ENDPOINT = '';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_LIFF_ENDPOINT_URL ??
  'http://localhost:3000';

const LINE_LIFF_URL =
  process.env.NEXT_PUBLIC_LIFF_ENDPOINT_URL ?? process.env.NEXT_PUBLIC_APP_URL;

export function getApiBaseUrl(): string {
  return LOCAL_API_ENDPOINT;
}

/**
 * Returns an absolute HTTPS base URL for use with FileModule.downloadFile,
 * which requires a full URL (relative paths are rejected with status 400).
 * On grab.dev and local dev, the browser origin itself proxies /api/* to the backend.
 */
export function getAbsoluteApiBaseUrl(): string {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  return APP_URL;
}

export function getCurrentEnv(): 'prod' | 'qa' {
  if (typeof window === 'undefined') return 'qa';
  return window.location.hostname === 'localhost' ? 'qa' : 'prod';
}

/**
 * Builds the HTTPS QR URL to be printed on buses.
 * When scanned with the in-app camera, routeCode is extracted from the URL.
 * When scanned with an external camera, the browser opens this URL and
 * the scan page auto-redirects to the Grab app via buildConsentDeeplink().
 */
export function buildQrUrl(routeCode: string, env: 'qa' | 'prod'): string {
  const base = env === 'prod' ? LINE_LIFF_URL ?? APP_URL : APP_URL;
  return `${base}/scan?routeCode=${encodeURIComponent(routeCode)}`;
}

/**
 * Builds the LIFF app URL for QR or browser launches.
 */
export function buildConsentDeeplink(
  env: 'qa' | 'prod',
  sessionParams?: Record<string, string>,
): string {
  const base = env === 'prod' ? LINE_LIFF_URL ?? APP_URL : APP_URL;
  const url = new URL('/scan', base);
  Object.entries(sessionParams ?? {}).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  return url.toString();
}

export const APP_NAME = 'nasum-church-shuttle';

export const LIFF_ID =
  process.env.NEXT_PUBLIC_LIFF_ID_DEV ?? process.env.NEXT_PUBLIC_LIFF_ID ?? '';

export const HEADER_HEIGHT = 70;
