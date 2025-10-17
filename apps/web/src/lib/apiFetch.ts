/**
 * Enhanced API fetch wrapper with CSRF rotation, retry, idempotency, and degraded mode support
 * 
 * Features:
 * - Enforces credentials:'include' for all requests
 * - Auto-attaches x-csrf-token for write operations
 * - Retries once on 401/419 with CSRF token rotation/priming
 * - Adds per-write idempotency key to prevent duplicate operations
 * - Emits degraded-mode event on x-degraded-mode: 1 header
 * - Centralizes auth/CSRF/credentials + consistent error surface
 */

declare global {
  interface Window { 
    __csrf?: string;
    __degraded?: boolean;
  }
}

export interface ApiFetchError extends Error {
  status: number;
  degraded?: boolean;
}

/**
 * Enhanced API fetch wrapper
 */
export async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const headers = new Headers(init.headers ?? {});
  
  // Always send credentials
  const fetchOptions: RequestInit = {
    ...init,
    credentials: 'include',
    headers,
  };

  // Attach CSRF token for write operations if available
  if (isWrite && typeof window !== 'undefined' && window.__csrf) {
    headers.set("x-csrf-token", window.__csrf);
  }
  
  // Add idempotency key for write operations
  if (isWrite && !headers.get('Idempotency-Key')) {
    const key = `idem-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    headers.set('Idempotency-Key', key);
  }

  const doFetch = async (): Promise<Response> => {
    return fetch(input, fetchOptions);
  };

  let attempt = 0;
  const maxAttempts = 2; // Retry once on 401/419

  for (;;) {
    const response = await doFetch();

    // Handle CSRF token rotation
    const rotated = response.headers.get("x-csrf-rotate");
    if (rotated && typeof window !== 'undefined') {
      window.__csrf = rotated;
    }

    // Handle degraded mode
    const degradedHeader = response.headers.get("x-degraded-mode");
    if (degradedHeader === "1" && typeof window !== 'undefined') {
      window.__degraded = true;
      try {
        window.dispatchEvent(new Event('degraded-mode'));
      } catch (e) {
        // Ignore dispatch errors
      }
    }

    // Retry once on 401/419 by rotating/priming token
    if ((response.status === 401 || response.status === 419) && attempt < 1) {
      if (!rotated && typeof window !== 'undefined') {
        try {
          // Prime CSRF token
          const prime = await fetch('/api/csrf', { 
            credentials: 'include',
            cache: 'no-store'
          });
          const token = prime.headers.get('x-csrf-rotate');
          if (token) {
            window.__csrf = token;
          }
        } catch (e) {
          // Ignore priming errors
        }
      }
      attempt++;
      continue;
    }

    // Handle errors with degraded mode context
    if (!response.ok) {
      const error: ApiFetchError = new Error(`HTTP ${response.status}`) as ApiFetchError;
      error.status = response.status;
      error.degraded = degradedHeader === "1";
      throw error;
    }

    return response;
  }
}

/**
 * Convenience method for JSON responses
 */
export async function apiFetchJson<T>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init);
  return response.json();
}

/**
 * Initialize CSRF token on app startup
 */
export async function initializeCsrf(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const response = await fetch('/api/csrf', { 
      credentials: 'include',
      cache: 'no-store'
    });
    const token = response.headers.get('x-csrf-rotate');
    if (token) {
      window.__csrf = token;
    }
  } catch (e) {
    // Ignore initialization errors
  }
}