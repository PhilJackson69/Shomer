/**
 * Dev Runtime Warning for Raw Fetch Usage
 * 
 * This module provides runtime warnings in development mode
 * when raw fetch() is used instead of apiFetch or externalFetch.
 */

declare global {
  interface Window {
    __fetchWarningShown?: boolean;
  }
}

/**
 * Override global fetch in development to warn about raw usage
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalFetch = window.fetch;
  
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    // Check if this is coming from our allowed files
    const stack = new Error().stack || '';
    const isAllowedFile = stack.includes('apiFetch.ts') || 
                         stack.includes('external-fetch.ts') ||
                         stack.includes('api-client.ts');
    
    if (!isAllowedFile && !window.__fetchWarningShown) {
      console.warn(
        '🚨 Raw fetch() detected! Use apiFetch for internal APIs or externalFetch for external APIs.\n' +
        'Raw fetch() bypasses CSRF rotation, credentials, and idempotency handling.\n' +
        'Stack trace:', stack
      );
      window.__fetchWarningShown = true;
    }
    
    return originalFetch.call(this, input, init);
  };
}