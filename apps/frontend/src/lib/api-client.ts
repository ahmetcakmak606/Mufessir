import { tokenStorage } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiRequestOptions = {
  method?: ApiMethod;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token, signal }: ApiRequestOptions = {}
): Promise<T> {
  const resolvedToken = token ?? tokenStorage.get();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed' }));
    const message =
      typeof errorBody?.error === 'string' && errorBody.error.length > 0
        ? errorBody.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export { API_BASE_URL };
