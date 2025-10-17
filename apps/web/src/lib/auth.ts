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

