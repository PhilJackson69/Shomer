/**
 * Vitest tests for apiFetch CSRF rotation and degraded mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, apiFetchJson } from '@/lib/apiFetch';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window for browser environment
Object.defineProperty(global, 'window', {
  value: {
    location: {
      origin: 'http://localhost:3000'
    },
    __csrf: undefined,
    __degraded: undefined,
    dispatchEvent: vi.fn()
  },
  writable: true
});

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window state
    if (typeof global.window !== 'undefined') {
      global.window.__csrf = undefined;
      global.window.__degraded = undefined;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSRF token handling', () => {
    it('should attach CSRF token for write operations', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await apiFetch('/api/test', { method: 'POST', body: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.any(Headers)
        })
      );

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('x-csrf-token')).toBeDefined();
    });

    it('should not attach CSRF token for GET operations', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await apiFetch('/api/test', { method: 'GET' });

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('x-csrf-token')).toBeNull();
    });

    it('should rotate CSRF token when server responds with x-csrf-rotate', async () => {
      const mockResponse = new Response('{}', { 
        status: 200,
        headers: { 'x-csrf-rotate': 'new-token-123' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await apiFetch('/api/test', { method: 'POST' });

      expect(global.window.__csrf).toBe('new-token-123');
    });

    it('should retry once on 401 with CSRF token rotation', async () => {
      const mockResponse1 = new Response('{}', { 
        status: 401,
        headers: { 'x-csrf-rotate': 'rotated-token' }
      });
      const mockResponse2 = new Response('{}', { status: 200 });
      
      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await apiFetch('/api/test', { method: 'POST' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(global.window.__csrf).toBe('rotated-token');
    });

    it('should retry once on 419 with CSRF token rotation', async () => {
      const mockResponse1 = new Response('{}', { 
        status: 419,
        headers: { 'x-csrf-rotate': 'rotated-token' }
      });
      const mockResponse2 = new Response('{}', { status: 200 });
      
      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      await apiFetch('/api/test', { method: 'POST' });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(global.window.__csrf).toBe('rotated-token');
    });
  });

  describe('Idempotency key handling', () => {
    it('should add idempotency key for write operations', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await apiFetch('/api/test', { method: 'POST' });

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers as Headers;
      const idempotencyKey = headers.get('Idempotency-Key');
      
      expect(idempotencyKey).toMatch(/^idem-[a-z0-9]+-\d+$/);
    });

    it('should not add idempotency key for GET operations', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await apiFetch('/api/test', { method: 'GET' });

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('Idempotency-Key')).toBeNull();
    });

    it('should not override existing idempotency key', async () => {
      mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await apiFetch('/api/test', { 
        method: 'POST',
        headers: { 'Idempotency-Key': 'custom-key' }
      });

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('Idempotency-Key')).toBe('custom-key');
    });
  });

  describe('Degraded mode handling', () => {
    it('should set degraded mode flag when x-degraded-mode header is present', async () => {
      const mockResponse = new Response('{}', { 
        status: 200,
        headers: { 'x-degraded-mode': '1' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Mock dispatchEvent
      const dispatchEventSpy = vi.spyOn(global.window, 'dispatchEvent').mockImplementation(() => true);

      await apiFetch('/api/test');

      expect(global.window.__degraded).toBe(true);
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(new Event('degraded-mode'));
    });

    it('should include degraded flag in error when response is not ok', async () => {
      const mockResponse = new Response('{}', { 
        status: 500,
        headers: { 'x-degraded-mode': '1' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiFetch('/api/test')).rejects.toMatchObject({
        status: 500,
        degraded: true
      });
    });
  });

  describe('apiFetchJson', () => {
    it('should return parsed JSON response', async () => {
      const mockData = { message: 'success' };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockData), { 
        status: 200 
      }));

      const result = await apiFetchJson('/api/test');

      expect(result).toEqual(mockData);
    });
  });

  describe('Error handling', () => {
    it('should throw error with status and degraded flag', async () => {
      const mockResponse = new Response('{}', { 
        status: 404,
        headers: { 'x-degraded-mode': '1' }
      });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiFetch('/api/test')).rejects.toMatchObject({
        status: 404,
        degraded: true
      });
    });

    it('should not retry on non-401/419 errors', async () => {
      const mockResponse = new Response('{}', { status: 500 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(apiFetch('/api/test', { method: 'POST' })).rejects.toMatchObject({
        status: 500
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
