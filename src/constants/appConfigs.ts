export const LOCAL_API_ENDPOINT = '';
const LIFF_PERMALINK_BASE = 'https://liff.line.me';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_LIFF_ENDPOINT_URL ??
  'http://localhost:3000';
const PRODUCTION_UNIVERSAL_LINK_BASE = 'https://nasum-church-shuttle.vercel.app';

const LINE_LIFF_URL =
  process.env.NEXT_PUBLIC_LIFF_ENDPOINT_URL ?? process.env.NEXT_PUBLIC_APP_URL;
const LIFF_ID_QA = process.env.NEXT_PUBLIC_LIFF_ID_DEV ?? '';
const LIFF_ID_PROD = process.env.NEXT_PUBLIC_LIFF_ID ?? LIFF_ID_QA;

export function getApiBaseUrl(): string {
  return LOCAL_API_ENDPOINT;
}

/**
 * Returns an absolute HTTPS base URL for external download links.
 * Download endpoints require a full URL (relative paths are rejected with status 400).
 * On local dev, the browser origin itself proxies /api/* to the backend.
 */
export function getAbsoluteApiBaseUrl(): string {
  const base = getApiBaseUrl();
  if (base) return base;
  if (typeof window !== 'undefined') return window.location.origin;
  return APP_URL;
}

/**
 * Builds the HTTPS QR URL to be printed on buses.
 * When scanned with the in-app camera, routeCode is extracted from the URL.
 * When scanned with an external camera, the browser opens this URL and
 * the scan page auto-opens the LINE app via LIFF permalink.
 */
export function buildQrUrl(routeCode: string, env: 'qa' | 'prod'): string {
  return buildUniversalScanUrl(routeCode, env);
}

/**
 * Builds the canonical HTTPS scan URL used in printed QR codes.
 * Native iOS/Android apps can claim this URL via Universal Links/App Links,
 * while devices without the app still land on the web /scan fallback.
 */
export function buildUniversalScanUrl(
  routeCode: string,
  env: 'qa' | 'prod',
): string {
  const base = env === 'prod' ? PRODUCTION_UNIVERSAL_LINK_BASE : APP_URL;
  const url = new URL('/scan', base);
  url.searchParams.set('routeCode', routeCode);
  return url.toString();
}

function getLiffIdForEnv(env: 'qa' | 'prod'): string {
  return env === 'prod' ? LIFF_ID_PROD || LIFF_ID_QA : LIFF_ID_QA || LIFF_ID_PROD;
}

export function getCurrentEnv(): 'prod' | 'qa' {
  if (typeof window === 'undefined') return 'qa';
  return window.location.hostname === 'localhost' ? 'qa' : 'prod';
}

/**
 * Builds a LIFF permalink that opens /scan with route parameters in the LINE app.
 */
export function buildLiffPermalink(
  env: 'qa' | 'prod',
  sessionParams?: Record<string, string>,
): string {
  const liffId = getLiffIdForEnv(env);
  if (!liffId) {
    const base = LINE_LIFF_URL ?? APP_URL;
    const fallback = new URL('/scan', base);
    Object.entries(sessionParams ?? {}).forEach(([key, value]) =>
      fallback.searchParams.set(key, value),
    );
    return fallback.toString();
  }

  // Use LIFF direct-path permalink to avoid nested liff.state redirects.
  const permalink = new URL(`${LIFF_PERMALINK_BASE}/${liffId}/scan`);
  Object.entries(sessionParams ?? {}).forEach(([key, value]) =>
    permalink.searchParams.set(key, value),
  );
  return permalink.toString();
}

export const APP_NAME = 'nasum-church-shuttle';

export const LIFF_ID = LIFF_ID_PROD || LIFF_ID_QA;

export const HEADER_HEIGHT = 70;
