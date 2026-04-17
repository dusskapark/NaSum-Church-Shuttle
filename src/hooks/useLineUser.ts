import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getLiff } from '../lib/liff';
import { logError, logInfo, logWarn } from '../lib/logger';
import type { LineUser, Nullable, UserRole } from '@app-types/core';
import { getApiBaseUrl } from '../constants/appConfigs';
import { resetAuthExpiredPending } from '../lib/api';

interface UseLineUserResult {
  user: Nullable<LineUser>;
  loading: boolean;
  error: Nullable<unknown>;
  isInClient: boolean;
  isReady: boolean;
}

const LINE_USER_CONTEXT_DEFAULT: UseLineUserResult = {
  user: null,
  loading: true,
  error: null,
  isInClient: false,
  isReady: false,
};

const LineUserContext = createContext<UseLineUserResult>(
  LINE_USER_CONTEXT_DEFAULT,
);

export const AUTH_STORAGE_KEY = 'line-shuttle:auth';
const DEV_BYPASS_TOKEN = 'dev-bypass-local-admin';

export interface StoredAuth {
  // internal application user id
  userId: string;
  // LINE provider user id from backend-verified ID token sub
  providerUid: string;
  displayName: string;
  pictureUrl: string | null;
  statusMessage: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  idToken: string;
}

export function isIdTokenExpired(idToken: string): boolean {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function getStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw) as StoredAuth;
    if (!auth.idToken || !auth.userId || !auth.providerUid || isIdTokenExpired(auth.idToken)) {
      clearStoredAuth();
      return null;
    }
    return auth;
  } catch {
    clearStoredAuth();
    return null;
  }
}

function toLineUser(auth: StoredAuth): LineUser {
  return {
    userId: auth.userId,
    providerUid: auth.providerUid,
    displayName: auth.displayName,
    pictureUrl: auth.pictureUrl,
    statusMessage: auth.statusMessage,
    email: auth.email,
    phone: auth.phone,
    role: auth.role,
  };
}

function normalizeReturnToPath(rawPath: string): string {
  if (typeof window === 'undefined') return rawPath;

  try {
    let url = new URL(rawPath, window.location.origin);

    for (let i = 0; i < 4; i += 1) {
      const state = url.searchParams.get('liff.state');
      if (!state) break;

      const decoded = decodeURIComponent(state);
      const nested = decoded.startsWith('?') ? decoded.slice(1) : decoded;

      if (nested.startsWith('liff.state=')) {
        url = new URL(`/?${nested}`, window.location.origin);
        continue;
      }

      url = nested.startsWith('http')
        ? new URL(nested)
        : new URL(nested, window.location.origin);
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return rawPath;
  }
}

function useProvideLineUser(): UseLineUserResult {
  const [user, setUser] = useState<Nullable<LineUser>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Nullable<unknown>>(null);
  const [isInClient, setIsInClient] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const authInProgressRef = useRef(false);

  const initAuth = useCallback(async () => {
    if (authInProgressRef.current) return;
    authInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const liff = await getLiff();
      const inClient = !!liff?.isInClient();
      setIsInClient(inClient);

      const isLocalDev =
        process.env.NODE_ENV === 'development' &&
        typeof window !== 'undefined' &&
        window.location.hostname === 'localhost';

      if (isLocalDev) {
        const devAuth: StoredAuth = {
          userId: 'dev-user-001',
          providerUid: 'dev-user-001',
          displayName: 'Developer (admin)',
          pictureUrl: null,
          statusMessage: 'Local development bypass',
          email: 'dev@example.com',
          phone: null,
          role: 'admin',
          idToken: DEV_BYPASS_TOKEN,
        };
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(devAuth));
        setUser(toLineUser(devAuth));
        setIsReady(true);
        return;
      }

      const stored = getStoredAuth();
      if (stored) {
        setUser(toLineUser(stored));
        setIsReady(true);

        // Refresh backend session to keep role/profile in sync with server-side changes.
        if (liff?.isLoggedIn()) {
          try {
            const refreshed = await storeAuthFromBackend();
            setUser(toLineUser(refreshed));
          } catch (refreshErr) {
            if (
              refreshErr instanceof Error &&
              refreshErr.message.includes('line-auth expired: redirecting')
            ) {
              throw refreshErr;
            }
            logWarn('[auth] failed to refresh stored auth, using cached auth', {
              error:
                refreshErr instanceof Error
                  ? refreshErr.message
                  : String(refreshErr),
            });
          }
        }

        const emailFromToken = liff?.getDecodedIDToken()?.email ?? null;
        if (emailFromToken) {
          setUser((prev) => (prev ? { ...prev, email: emailFromToken } : prev));
        }
        return;
      }

      if (!liff) {
        throw new Error('LIFF is not configured');
      }

      if (window.location.pathname === '/oauth-callback') return;

      if (!liff.isLoggedIn()) {
        sessionStorage.setItem(
          'line:returnTo',
          normalizeReturnToPath(window.location.pathname + window.location.search),
        );
        liff.login({
          redirectUri: `${window.location.origin}/oauth-callback`,
        });
        return;
      }

      const auth = await storeAuthFromBackend();
      setUser(toLineUser(auth));
      setIsReady(true);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes('line-auth expired: redirecting')
      ) {
        return;
      }
      logError('[auth] LIFF auth error', err);
      setError(err);
    } finally {
      setLoading(false);
      authInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    initAuth().catch(() => {});
  }, [initAuth]);

  useEffect(() => {
    const handleAuthExpired = () => {
      logWarn('[auth] auth:expired event received');
      clearStoredAuth();
      setUser(null);
      setIsReady(false);
      setLoading(true);
      initAuth()
        .finally(() => {
          resetAuthExpiredPending();
        })
        .catch(() => {});
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [initAuth]);

  return { user, loading, error, isInClient, isReady };
}

export function LineUserProvider({ children }: { children: ReactNode }) {
  const value = useProvideLineUser();
  return createElement(LineUserContext.Provider, { value }, children);
}

export function useLineUser(): UseLineUserResult {
  return useContext(LineUserContext);
}

export function clearStoredAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function storeAuthFromBackend(): Promise<StoredAuth> {
  const liff = await getLiff();
  if (!liff?.isLoggedIn()) {
    throw new Error('LIFF session is required');
  }

  const profile = await liff.getProfile().catch(() => null);
  const decoded = liff.getDecodedIDToken();
  const idToken = liff.getIDToken();

  if (!idToken) {
    throw new Error('LIFF ID token is unavailable');
  }

  logInfo('[auth] POST /api/v1/line-auth/session');
  const res = await fetch(`${getApiBaseUrl()}/api/v1/line-auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken,
      profile: profile
        ? {
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl ?? null,
            statusMessage: profile.statusMessage ?? null,
          }
        : null,
      decodedIdToken: decoded ?? null,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (
      res.status === 401 &&
      /LINE_ID_TOKEN_EXPIRED|IdToken expired|expired/i.test(body)
    ) {
      sessionStorage.setItem(
        'line:returnTo',
        normalizeReturnToPath(window.location.pathname + window.location.search),
      );
      try {
        // Refresh LIFF login when backend rejects an expired LINE ID token.
        liff.logout();
      } catch {
        // ignore logout errors and continue login attempt
      }
      liff.login({
        redirectUri: `${window.location.origin}/oauth-callback`,
      });
      throw new Error('line-auth expired: redirecting to LINE login');
    }
    throw new Error(`line-auth failed: ${res.status} ${body}`);
  }

  const auth = (await res.json()) as Partial<StoredAuth>;
  if (!auth.userId || !auth.providerUid || !auth.idToken) {
    throw new Error('line-auth failed: invalid session payload');
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  return auth as StoredAuth;
}
