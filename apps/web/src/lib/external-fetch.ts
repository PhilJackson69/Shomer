/**
 * External Fetch Escape Hatch
 * 
 * This module provides intentional access to raw fetch() for external APIs
 * that should NOT use our internal apiFetch wrapper (CSRF, credentials, etc.).
 * 
 * Use this ONLY for:
 * - Third-party API calls (external services)
 * - Webhook endpoints
 * - Public APIs that don't require authentication
 * - CDN/static asset requests
 * 
 * DO NOT use this for internal API calls - use apiFetch instead.
 */

/**
 * Raw fetch for external APIs only
 * 
 * This bypasses all internal auth, CSRF, and retry logic.
 * Use only for external services that don't need our internal handling.
 */
export const externalFetch = fetch;

/**
 * External fetch with basic error handling
 */
export async function externalFetchJson<T>(
  input: RequestInfo, 
  init: RequestInit = {}
): Promise<T> {
  const response = await externalFetch(input, init);
  
  if (!response.ok) {
    throw new Error(`External API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * External fetch for webhooks with timeout
 */
export async function webhookFetch(
  url: string, 
  payload: any, 
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await externalFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * External fetch for public APIs (no auth required)
 */
export async function publicApiFetch(
  input: RequestInfo, 
  init: RequestInit = {}
): Promise<Response> {
  return externalFetch(input, {
    ...init,
    // Explicitly no credentials for public APIs
    credentials: 'omit',
  });
}