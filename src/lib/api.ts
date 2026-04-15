import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  type StoredAuth,
} from '../hooks/useLineUser';
import { logWarn } from './logger';

function getIdToken(): string | null {
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const auth: StoredAuth = JSON.parse(stored);
    return auth.idToken ?? null;
  } catch {
    return null;
  }
}

// Deduplicate auth:expired events — concurrent 401s (e.g. multiple admin API calls
// firing at once) must not trigger multiple authorize() flows, which would race to
// overwrite each other's code_verifier in localStorage → PKCE 15151 mismatch.
let authExpiredPending = false;
export function resetAuthExpiredPending(): void {
  authExpiredPending = false;
}

export async function authedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getIdToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    clearStoredAuth();
    if (!authExpiredPending) {
      logWarn('[api] 401 received — dispatching auth:expired', { url });
      authExpiredPending = true;
      window.dispatchEvent(new CustomEvent('auth:expired'));
    } else {
      logWarn(
        '[api] 401 received — auth:expired already pending (deduplicated)',
        { url },
      );
    }
    throw new Error('Session expired');
  }
  return response;
}
