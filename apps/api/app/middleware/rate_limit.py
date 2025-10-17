"""
Rate limiting middleware with Redis token bucket implementation.

Provides defense-in-depth against abuse on sensitive endpoints like
evidence uploads, exports, and verification.
"""

import time
from typing import Optional, Callable, Dict, Tuple
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

from app.core.config import settings
from app.core.monitoring import security_event


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Token bucket rate limiter using Redis.
    
    Implements per-IP and per-user rate limits:
    - 60 requests/min per IP (general)
    - 10 requests/min per user (authenticated)
    - 5 requests/min for exports (high-cost operations)
    """

    def __init__(self, app, redis_client: Optional[redis.Redis] = None):
        super().__init__(app)
        self.redis_client = redis_client
        # In-memory fallback store: key -> (window_start_epoch, count)
        self._memory_limits: Dict[str, Tuple[int, int]] = {}

    async def dispatch(self, request: Request, call_next: Callable):
        """Process request with rate limiting."""
        is_redis_healthy = bool(self.redis_client)

        # Extract IP address
        ip_address = self._get_client_ip(request)
        
        # Extract user ID if authenticated
        user_id = None
        if hasattr(request.state, 'user') and request.state.user:
            user_id = request.state.user.id

        # Determine limits based on endpoint
        limits = self._get_rate_limits(request.url.path, user_id, degraded=not is_redis_healthy)
        
        # Check rate limits
        for limit_key, limit_config in limits.items():
            allowed, window = await self._check_rate_limit(
                limit_key,
                limit_config['max_requests'],
                limit_config['window_seconds'],
                use_memory_fallback=not is_redis_healthy,
            )
            
            if not allowed:
                # Blocked: include Retry-After and structured headers
                # Telemetry
                try:
                    security_event("rl_blocked", {"route": request.url.path})
                except Exception:
                    pass
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": f"Rate limit exceeded: {limit_config['max_requests']} requests per {limit_config['window_seconds']}s",
                        "retry_after": window
                    },
                    headers={
                        "Retry-After": str(window),
                        "X-RateLimit-Limit": str(limit_config['max_requests']),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time()) + int(window)),
                        # Standards-y mirror headers
                        "RateLimit-Limit": str(limit_config['max_requests']),
                        "RateLimit-Remaining": "0",
                        "RateLimit-Reset": str(int(time.time()) + int(window)),
                    }
                )

        # Process request
        response = await call_next(request)
        # Emit rate limit headers on success (best-effort based on first limit)
        first_limit = next(iter(limits.values())) if limits else None
        if first_limit and hasattr(response, 'headers'):
            # Compute remaining and reset heuristically from memory/redis independent window
            limit = int(first_limit['max_requests'])
            window = int(first_limit['window_seconds'])
            remaining = max(0, limit - 1)
            reset_sec = int(time.time()) + window
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(reset_sec)
            # Standards-y mirror
            response.headers["RateLimit-Limit"] = str(limit)
            response.headers["RateLimit-Remaining"] = str(remaining)
            response.headers["RateLimit-Reset"] = str(reset_sec)
        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request headers."""
        # Check X-Forwarded-For header (if behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client
        if request.client:
            return request.client.host
        
        return "unknown"

    def _get_rate_limits(self, path: str, user_id: Optional[int], degraded: bool = False) -> dict:
        """
        Determine rate limits for the request.
        
        Returns dict of limit configurations:
        {
            'ip': {'max_requests': 60, 'window_seconds': 60},
            'user': {'max_requests': 10, 'window_seconds': 60},
        }
        """
        limits = {}
        
        # Per-IP limits (default)
        ip_key = f"ratelimit:ip:{self._get_client_ip}"
        # Degraded stricter defaults when Redis is unhealthy
        defaults = {'max_requests': 60, 'window_seconds': 60}
        degraded_defaults = {'max_requests': 20, 'window_seconds': 60}
        limits[ip_key] = degraded_defaults if degraded else defaults
        
        # Per-user limits (authenticated users)
        if user_id:
            user_key = f"ratelimit:user:{user_id}"
            limits[user_key] = {'max_requests': 10, 'window_seconds': 60} if not degraded else {'max_requests': 8, 'window_seconds': 60}
        
        # Special limits for sensitive endpoints
        if '/evidence/upload' in path or ('/evidence' in path and 'POST' in path):
            # Upload limits
            upload_key = f"ratelimit:upload:{user_id or self._get_client_ip}"
            limits[upload_key] = {'max_requests': 10, 'window_seconds': 60} if not degraded else {'max_requests': 8, 'window_seconds': 10}
        
        if 'export-chain-of-custody' in path or '/verify' in path:
            # Export/verify limits (expensive operations)
            export_key = f"ratelimit:export:{user_id or self._get_client_ip}"
            limits[export_key] = {'max_requests': 5, 'window_seconds': 60} if not degraded else {'max_requests': 3, 'window_seconds': 60}
        
        return limits

    async def _check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        use_memory_fallback: bool = False,
    ) -> Tuple[bool, int]:
        """
        Token bucket rate limiter using Redis.
        
        Args:
            key: Unique identifier for this rate limit
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds
            
        Returns:
            (allowed, retry_after_seconds)
        """
        now = int(time.time())
        if not use_memory_fallback and self.redis_client:
            try:
                window_key = f"{key}:{int(now / window_seconds)}"
                pipeline = self.redis_client.pipeline()
                pipeline.incr(window_key)
                pipeline.expire(window_key, window_seconds * 2)
                results = await pipeline.execute()
                count = int(results[0])
                allowed = count <= max_requests
                retry_after = window_seconds if not allowed else 0
                return allowed, retry_after
            except Exception as e:
                # Fall through to memory fallback
                print(f"Rate limit check failed, using memory fallback: {e}")

        # In-memory fallback token bucket (coarse)
        bucket = self._memory_limits.get(key)
        window_start, count = bucket if bucket else (now, 0)
        # Reset window if expired
        if now - window_start >= window_seconds:
            window_start, count = now, 0
        count += 1
        self._memory_limits[key] = (window_start, count)
        allowed = count <= max_requests
        retry_after = max(0, window_seconds - (now - window_start)) if not allowed else 0
        return allowed, retry_after


async def get_redis_client() -> Optional[redis.Redis]:
    """Get Redis client for rate limiting."""
    try:
        client = redis.from_url(
            str(settings.REDIS_URL),
            encoding="utf-8",
            decode_responses=True
        )
        # Test connection
        await client.ping()
        return client
    except Exception as e:
        print(f"Redis connection failed: {e}")
        return None


# Decorator for endpoint-specific rate limiting
def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """
    Decorator to add rate limiting to specific endpoints.
    
    Usage:
        @router.post("/evidence/upload")
        @rate_limit(max_requests=10, window_seconds=60)
        async def upload_evidence(...):
            ...
    """
    def decorator(func):
        # Store rate limit config in function metadata
        func._rate_limit = {
            'max_requests': max_requests,
            'window_seconds': window_seconds
        }
        return func
    return decorator

