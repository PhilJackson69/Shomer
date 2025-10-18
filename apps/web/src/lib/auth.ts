/**
 * Authentication utilities
 */

import { apiFetch } from './apiFetch';
import { setAuthToken, removeAuthToken, getAuthToken } from './api-client';
export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "viewer" | "moderator" | "admin";
  is_active: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/**
 * Login with credentials
 */
export async function login(credentials: LoginCredentials): Promise<User> {
  // Login via OAuth2 password grant
  const formData = new URLSearchParams();
  formData.append('username', credentials.email);
  formData.append('password', credentials.password);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const data: LoginResponse = await apiFetch(`${apiUrl}/api/v1/auth/login`, { method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });
  
  // Store token
  setAuthToken(data.access_token);

  // Get user info
  const user = await getCurrentUser();
  return user;
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  removeAuthToken();
}

/**
 * Revoke all sessions (security feature)
 */
export async function revokeAllSessions(): Promise<void> {
  try {
    await apiFetch('/api/v1/auth/sessions/revoke-all', {
      method: 'POST',
    });
    
    // Force logout on all tabs using broadcast channel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('shomer-auth');
      channel.postMessage({ type: 'FORCE_LOGOUT', reason: 'Session reset for security' });
      channel.close();
    }
    
    // Clear local token
    removeAuthToken();
    
    // Show security banner
    if (typeof window !== 'undefined') {
      // Dispatch custom event for UI to show banner
      window.dispatchEvent(new CustomEvent('shomer-security-event', {
        detail: { type: 'SESSION_RESET', message: 'Session reset for security' }
      }));
    }
  } catch (error) {
    console.error('Failed to revoke all sessions:', error);
    // Still logout locally even if server call fails
    removeAuthToken();
  }
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>('/api/v1/users/me');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Server-side authentication check for pages
 * This is used in middleware and server components
 */
export async function getServerSession(): Promise<User | null> {
  try {
    const token = getAuthToken();
    if (!token) return null;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await apiFetch(`${apiUrl}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error("Failed to get server session:", error);
    return null;
  }
}

/**
 * JWKS fetch with retry and error handling
 */
export async function fetchJWKSWithRetry(maxRetries: number = 3): Promise<any> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const jwksUrl = `${apiUrl}/.well-known/jwks.json`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(jwksUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`);
      }
      
      const jwks = await response.json();
      
      // Validate JWKS structure
      if (!jwks.keys || !Array.isArray(jwks.keys)) {
        throw new Error('Invalid JWKS structure');
      }
      
      return jwks;
    } catch (error) {
      console.warn(`JWKS fetch attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        // Show user-friendly error message
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shomer-security-event', {
            detail: { 
              type: 'JWKS_ERROR', 
              message: 'Authentication service temporarily unavailable. Please refresh the page or try again later.',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }));
        }
        throw new Error('JWKS fetch failed after all retries');
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Enhanced login with JWKS validation
 */
export async function loginWithJWKSValidation(credentials: LoginCredentials): Promise<User> {
  try {
    // First, validate JWKS is accessible
    await fetchJWKSWithRetry();
    
    // Proceed with normal login
    return await login(credentials);
  } catch (error) {
    console.error('Login failed due to JWKS issues:', error);
    
    // Show user-friendly error
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('shomer-security-event', {
        detail: { 
          type: 'LOGIN_ERROR', 
          message: 'Unable to connect to authentication service. Please check your connection and try again.',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
    
    throw error;
  }
}

/**
 * Check if user has required role or higher
 */
export function hasRole(user: User, requiredRole: "viewer" | "moderator" | "admin"): boolean {
  const roleHierarchy = {
    viewer: 0,
    moderator: 1,
    admin: 2,
  };

  const userLevel = roleHierarchy[user.role] || -1;
  const requiredLevel = roleHierarchy[requiredRole] || 999;

  return userLevel >= requiredLevel;
}

