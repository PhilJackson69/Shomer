"""Rate limiter for ingestion workers."""

import asyncio
import time
from collections import deque


class RateLimiter:
    """Token bucket rate limiter."""

    def __init__(self, max_calls: int = 60, period: float = 60.0):
        """
        Initialize rate limiter.

        Args:
            max_calls: Maximum number of calls allowed
            period: Time period in seconds
        """
        self.max_calls = max_calls
        self.period = period
        self.calls: deque[float] = deque()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Acquire permission to make a call (blocks if rate limit exceeded)."""
        async with self._lock:
            now = time.time()

            # Remove calls outside the current period
            while self.calls and self.calls[0] <= now - self.period:
                self.calls.popleft()

            if len(self.calls) >= self.max_calls:
                # Rate limit exceeded, wait
                sleep_time = self.calls[0] + self.period - now
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                    return await self.acquire()

            # Record this call
            self.calls.append(now)

    def reset(self) -> None:
        """Reset the rate limiter."""
        self.calls.clear()

