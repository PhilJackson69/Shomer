"""Redis-based rate limiter for API endpoints."""

import asyncio
import json
import time
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta

import redis.asyncio as redis
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.config import settings


class RedisRateLimiter:
    """Redis-based rate limiter with sliding window algorithm."""
    
    def __init__(
        self,
        redis_client: Optional[redis.Redis] = None,
        default_limit: int = 100,
        default_window: int = 60
    ):
        """Initialize rate limiter."""
        self.redis = redis_client or redis.from_url(
            settings.REDIS_URL,
            decode_responses=True
        )
        self.default_limit = default_limit
        self.default_window = default_window
    
    async def is_allowed(
        self,
        key: str,
        limit: Optional[int] = None,
        window: Optional[int] = None
    ) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request is allowed under rate limit.
        
        Args:
            key: Unique identifier for the rate limit (e.g., user ID, IP)
            limit: Maximum requests allowed (uses default if None)
            window: Time window in seconds (uses default if None)
            
        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        limit = limit or self.default_limit
        window = window or self.default_window
        
        now = time.time()
        window_start = now - window
        
        # Use sliding window algorithm
        pipe = self.redis.pipeline()
        
        # Remove expired entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current requests
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(now): now})
        
        # Set expiration
        pipe.expire(key, window)
        
        results = await pipe.execute()
        current_requests = results[1]
        
        # Check if limit exceeded
        is_allowed = current_requests < limit
        
        # Calculate rate limit info
        rate_info = {
            "limit": limit,
            "remaining": max(0, limit - current_requests - 1),
            "reset_time": int(now + window),
            "current_requests": current_requests + 1
        }
        
        return is_allowed, rate_info
    
    async def get_rate_limit_info(
        self,
        key: str,
        limit: Optional[int] = None,
        window: Optional[int] = None
    ) -> Dict[str, int]:
        """Get current rate limit information without consuming a request."""
        limit = limit or self.default_limit
        window = window or self.default_window
        
        now = time.time()
        window_start = now - window
        
        # Remove expired entries and count
        await self.redis.zremrangebyscore(key, 0, window_start)
        current_requests = await self.redis.zcard(key)
        
        return {
            "limit": limit,
            "remaining": max(0, limit - current_requests),
            "reset_time": int(now + window),
            "current_requests": current_requests
        }
    
    async def reset_rate_limit(self, key: str) -> bool:
        """Reset rate limit for a key."""
        result = await self.redis.delete(key)
        return result > 0


# Global rate limiter instance
_rate_limiter: Optional[RedisRateLimiter] = None


def get_rate_limiter() -> RedisRateLimiter:
    """Get or create global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RedisRateLimiter()
    return _rate_limiter


def rate_limit(
    limit: int = 100,
    window: int = 60,
    key_func: Optional[callable] = None
):
    """
    Decorator for rate limiting FastAPI endpoints.
    
    Args:
        limit: Maximum requests allowed
        window: Time window in seconds
        key_func: Function to generate rate limit key from request
    """
    def decorator(func):
        async def wrapper(request: Request, *args, **kwargs):
            # Generate rate limit key
            if key_func:
                rate_key = key_func(request)
            else:
                # Default: use IP address
                client_ip = request.client.host
                rate_key = f"rate_limit:{func.__name__}:{client_ip}"
            
            # Check rate limit
            rate_limiter = get_rate_limiter()
            is_allowed, rate_info = await rate_limiter.is_allowed(
                rate_key, limit, window
            )
            
            if not is_allowed:
                response = JSONResponse(
                    status_code=429,
                    content={
                        "error": "Rate limit exceeded",
                        "rate_limit_info": rate_info
                    },
                    headers={
                        "X-RateLimit-Limit": str(rate_info["limit"]),
                        "X-RateLimit-Remaining": str(rate_info["remaining"]),
                        "X-RateLimit-Reset": str(rate_info["reset_time"]),
                        "Retry-After": str(window)
                    }
                )
                return response
            
            # Add rate limit headers to response
            response = await func(request, *args, **kwargs)
            if hasattr(response, 'headers'):
                response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
                response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
                response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
            
            return response
        
        return wrapper
    return decorator


def get_client_ip(request: Request) -> str:
    """Get client IP address from request."""
    # Check for forwarded headers (proxy/load balancer)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct client IP
    return request.client.host


def get_user_rate_limit_key(request: Request) -> str:
    """Generate rate limit key based on authenticated user."""
    # Try to get user ID from auth header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        # In a real implementation, you'd decode the JWT to get user ID
        # For now, use a hash of the token
        import hashlib
        user_hash = hashlib.md5(token.encode()).hexdigest()[:8]
        return f"rate_limit:user:{user_hash}"
    
    # Fallback to IP-based limiting
    return f"rate_limit:ip:{get_client_ip(request)}"


# Predefined rate limit configurations
RATE_LIMITS = {
    "auth": {"limit": 5, "window": 300},      # 5 attempts per 5 minutes
    "api": {"limit": 100, "window": 60},      # 100 requests per minute
    "upload": {"limit": 10, "window": 60},    # 10 uploads per minute
    "search": {"limit": 50, "window": 60},    # 50 searches per minute
    "admin": {"limit": 200, "window": 60},    # 200 requests per minute for admins
}


def apply_rate_limit(limit_type: str = "api", key_func: Optional[callable] = None):
    """Apply predefined rate limit configuration."""
    config = RATE_LIMITS.get(limit_type, RATE_LIMITS["api"])
    return rate_limit(
        limit=config["limit"],
        window=config["window"],
        key_func=key_func
    )
