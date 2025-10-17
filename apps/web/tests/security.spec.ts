import { test, expect, request } from '@playwright/test';

test.describe('security', () => {
  test('blocks POST without CSRF', async ({ request }) => {
    const res = await request.post('/api/incidents/1/notes', { data: { body: 'hi' } });
    expect(res.status()).toBe(403);
  });

  test('rate limit emits headers', async ({ request }) => {
    const res = await request.get('/api/health');
    // allow either presence in success path or later via 429s
    expect(res.headers()).toHaveProperty('x-ratelimit-limit');
  });
});



