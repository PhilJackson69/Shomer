export function backoffAfter(resp: Response) {
  const ra = resp.headers.get('Retry-After');
  const reset = resp.headers.get('X-RateLimit-Reset');
  const secs = ra ? Number(ra) : (reset ? Number(reset) - Math.floor(Date.now() / 1000) : 1);
  const ms = Math.max(500, secs * 1000);
  return new Promise((res) => setTimeout(res, ms));
}

export async function withBackoff<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let i = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e: any) {
      const resp = e?.response as Response | undefined;
      if (resp && resp.status === 429 && i++ < attempts) {
        await backoffAfter(resp);
        continue;
      }
      throw e;
    }
  }
}



