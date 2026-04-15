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
import { ProfileModule } from '@grabjs/superapp-sdk';
import { getLiff } from '../lib/liff';
import { logError, logInfo, logWarn } from '../lib/logger';
import type { GrabUser, Nullable, UserRole } from '@app-types/core';
import { getApiBaseUrl } from '../constants/appConfigs';
import { resetAuthExpiredPending } from '../lib/api';

interface UseGrabUserResult {
  user: Nullable<GrabUser>;
  loading: boolean;
  error: Nullable<unknown>;
  isInClient: boolean;
  isReady: boolean;
}

const GRAB_USER_CONTEXT_DEFAULT: UseGrabUserResult = {
  user: null,
  loading: true,
  error: null,
  isInClient: false,
  isReady: false,
};

const GrabUserContext = createContext<UseGrabUserResult>(
  GRAB_USER_CONTEXT_DEFAULT,
);

export const AUTH_STORAGE_KEY = 'grab-shuttle:auth';
const DEV_BYPASS_TOKEN = 'dev-bypass-local-admin';

export interface StoredAuth {
  userId: string;
  displayName: string;
  pictureUrl: string | null;
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
    if (!auth.idToken || !auth.userId || isIdTokenExpired(auth.idToken)) {
      clearStoredAuth();
      return null;
    }
    return auth;
  } catch {
    clearStoredAuth();
    return null;
  }
}

function toGrabUser(auth: StoredAuth): GrabUser {
  return {
    userId: auth.userId,
    displayName: auth.displayName,
    pictureUrl: auth.pictureUrl,
    email: auth.email,
    phone: auth.phone,
    role: auth.role,
  };
}

function useProvideGrabUser(): UseGrabUserResult {
  const [user, setUser] = useState<Nullable<GrabUser>>(null);
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
          displayName: 'Developer (admin)',
          pictureUrl: null,
          email: 'dev@example.com',
          phone: null,
          role: 'admin',
          idToken: DEV_BYPASS_TOKEN,
        };
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(devAuth));
        setUser(toGrabUser(devAuth));
        setIsReady(true);
        return;
      }

      const stored = getStoredAuth();
      if (stored) {
        setUser(toGrabUser(stored));
        setIsReady(true);

        const profileModule = new ProfileModule();
        const emailResult = await profileModule.fetchEmail().catch(() => null);
        if (emailResult?.status_code === 200 && emailResult.result?.email) {
          setUser((prev) =>
            prev ? { ...prev, email: emailResult.result.email ?? null } : prev,
          );
        }
        return;
      }

      if (!liff) {
        throw new Error('LIFF is not configured');
      }

      if (window.location.pathname === '/oauth-callback') return;

      if (!liff.isLoggedIn()) {
        sessionStorage.setItem(
          'grab:returnTo',
          window.location.pathname + window.location.search,
        );
        liff.login({
          redirectUri: `${window.location.origin}/oauth-callback`,
        });
        return;
      }

      const auth = await storeAuthFromBackend();
      setUser(toGrabUser(auth));
      setIsReady(true);
    } catch (err) {
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

export function GrabUserProvider({ children }: { children: ReactNode }) {
  const value = useProvideGrabUser();
  return createElement(GrabUserContext.Provider, { value }, children);
}

export function useGrabUser(): UseGrabUserResult {
  return useContext(GrabUserContext);
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
            userId: profile.userId,
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
    throw new Error(`line-auth failed: ${res.status} ${body}`);
  }

  const auth = (await res.json()) as StoredAuth;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  return auth;
}
