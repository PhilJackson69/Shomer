"""
Idempotency middleware to deduplicate client retries for write requests.

Uses Redis when available, with in-memory TTL fallback when degraded.
"""

import time
from typing import Callable, Optional, Dict, Tuple

from fastapi import Request
from fastapi.responses import Response, JSONResponse
from app.core.monitoring import security_event
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis


class IdempotencyMiddleware(BaseHTTPMiddleware):
    HEADER_NAME = "X-Idempotency-Key"

    def __init__(self, app, redis_client: Optional[redis.Redis] = None, ttl_seconds: int = 3600):
        super().__init__(app)
        self.redis = redis_client
        self.ttl = ttl_seconds
        self.memory: Dict[str, Tuple[int, int]] = {}  # key -> (status_code, expires_at)

    async def dispatch(self, request: Request, call_next: Callable):
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await call_next(request)

        key = request.headers.get(self.HEADER_NAME)
        if not key:
            return await call_next(request)

        scope = f"idem:{request.url.path}:{key}"

        # Try Redis first
        if self.redis:
            try:
                was_set = await self.redis.setnx(scope, "1")
                if not was_set:
                    # Duplicate
                try:
                    security_event("idem_duplicate", {"route": request.url.path})
                except Exception:
                    pass
                return JSONResponse(status_code=200, content={"ok": True, "idempotent": True})
                await self.redis.expire(scope, self.ttl)
            except Exception:
                # Degrade to memory
                pass

        # Memory fallback
        now = int(time.time())
        if scope in self.memory:
            status_code, expires_at = self.memory[scope]
            if now < expires_at:
                try:
                    security_event("idem_duplicate", {"route": request.url.path})
                except Exception:
                    pass
                return JSONResponse(status_code=status_code, content={"ok": True, "idempotent": True})

        response: Response = await call_next(request)

        # Store memory record for duplicates for ttl
        self.memory[scope] = (response.status_code, now + self.ttl)
        return response


