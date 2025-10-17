/**
 * API Client configuration using the OpenAPI client from @shomer/shared
 */

import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * Get authentication token from cookie
 */
export function getAuthToken(): string | undefined {
  return Cookies.get('auth_token');
}

/**
 * Set authentication token in cookie
 */
export function setAuthToken(token: string): void {
  Cookies.set('auth_token', token, {
    expires: 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

/**
 * Remove authentication token
 */
export function removeAuthToken(): void {
  Cookies.remove('auth_token');
}

/**
 * Create API client with authentication
 */
export function createApiClient() {
  const token = getAuthToken();

  return {
    baseUrl: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
}

// Note: apiFetch function moved to ./apiFetch.ts for unified CSRF handling

