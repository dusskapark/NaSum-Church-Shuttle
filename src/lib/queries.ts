import { authedFetch } from './api';
import { getApiBaseUrl } from '../constants/appConfigs';

/** GET request helper for useQuery's queryFn */
export async function fetchApi<T>(path: string): Promise<T> {
  const res = await authedFetch(`${getApiBaseUrl()}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

/** Mutation helper for useMutation's mutationFn */
export async function mutateApi<T>(
  path: string,
  options: { method: string; body?: unknown },
): Promise<T> {
  const res = await authedFetch(`${getApiBaseUrl()}${path}`, {
    method: options.method,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return null as T;
  return res.json();
}
