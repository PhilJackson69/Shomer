"""
Request ID middleware for distributed tracing.

Adds unique request IDs to all requests and responses for correlation
across logs, traces, and monitoring systems.
"""

import uuid
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add unique request IDs to all requests.
    
    - Generates or uses existing X-Request-ID header
    - Adds request ID to response headers
    - Adds request ID to logging context
    """

    HEADER_NAME = "X-Request-ID"

    async def dispatch(self, request: Request, call_next: Callable):
        """Process request with ID tracking."""
        
        # Get or generate request ID
        request_id = request.headers.get(self.HEADER_NAME)
        if not request_id:
            request_id = str(uuid.uuid4())
        
        # Store in request state for access by endpoints
        request.state.request_id = request_id
        
        # Add to logging context
        logger = logging.getLogger("uvicorn")
        old_factory = logging.getLogRecordFactory()
        
        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.request_id = request_id
            return record
        
        logging.setLogRecordFactory(record_factory)
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response headers
        response.headers[self.HEADER_NAME] = request_id
        
        # Restore old logging factory
        logging.setLogRecordFactory(old_factory)
        
        return response

