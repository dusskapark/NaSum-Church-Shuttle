'use client';

import { useCallback, useMemo } from 'react';
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';

type NavigateOptions = {
  replace?: boolean;
};

type SetSearchParamsOptions = {
  replace?: boolean;
};

type SearchParamsUpdater =
  | URLSearchParams
  | string
  | Record<string, string | number | boolean | null | undefined>
  | Array<[string, string]>
  | ((prev: URLSearchParams) => SearchParamsUpdater);

function toSearchParams(value: SearchParamsUpdater): URLSearchParams {
  if (value instanceof URLSearchParams) return new URLSearchParams(value);
  if (typeof value === 'string') return new URLSearchParams(value);
  if (Array.isArray(value)) return new URLSearchParams(value);
  if (typeof value === 'function') {
    throw new Error('Function updater must be resolved before parsing');
  }

  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue == null) continue;
    params.set(key, String(rawValue));
  }
  return params;
}

export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        if (typeof window !== 'undefined') {
          window.history.go(to);
        }
        return;
      }

      if (options?.replace) {
        router.replace(to);
        return;
      }

      router.push(to);
    },
    [router],
  );
}

export function useSearchParams(): [
  URLSearchParams,
  (nextInit: SearchParamsUpdater, options?: SetSearchParamsOptions) => void,
] {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const readonlyParams = useNextSearchParams();

  const searchParams = useMemo(
    () => new URLSearchParams(readonlyParams?.toString() ?? ''),
    [readonlyParams],
  );

  const setSearchParams = useCallback(
    (nextInit: SearchParamsUpdater, options?: SetSearchParamsOptions) => {
      const resolved =
        typeof nextInit === 'function' ? nextInit(searchParams) : nextInit;
      const nextParams = toSearchParams(resolved);
      const query = nextParams.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;

      if (options?.replace) {
        router.replace(nextUrl);
        return;
      }

      router.push(nextUrl);
    },
    [pathname, router, searchParams],
  );

  return [searchParams, setSearchParams];
}

export function useLocation() {
  const pathname = usePathname() ?? '/';
  const params = useNextSearchParams();
  const search = params?.toString() ?? '';

  return useMemo(
    () => ({
      pathname,
      search: search ? `?${search}` : '',
    }),
    [pathname, search],
  );
}

export function useParams<T extends Record<string, string | undefined>>() {
  const params = useNextParams();

  return useMemo(() => {
    const normalized: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(params ?? {})) {
      normalized[key] = Array.isArray(value) ? value[0] : value;
    }
    return normalized as T;
  }, [params]);
}
