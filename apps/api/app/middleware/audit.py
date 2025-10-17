"""Enhanced audit middleware with before/after tracking."""

import json
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.db.base import SessionLocal
from app.models.audit_log import AuditLog


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all API requests with before/after state."""

    # Methods that modify data
    WRITE_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}
    
    # Paths to exclude from audit logging
    EXCLUDED_PATHS = [
        '/health',
        '/docs',
        '/redoc',
        '/openapi.json',
        '/static',
    ]

    def __init__(self, app: ASGIApp):
        """Initialize middleware."""
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and log audit trail."""
        # Skip excluded paths
        if any(request.url.path.startswith(path) for path in self.EXCLUDED_PATHS):
            return await call_next(request)
        
        # Capture request start time
        start_time = time.time()
        
        # Extract user info from request state
        user_id = None
        if hasattr(request.state, 'user'):
            user_id = request.state.user.id
        
        # For write operations, capture request body
        before_state = None
        if request.method in self.WRITE_METHODS:
            try:
                body = await request.body()
                if body:
                    before_state = {
                        'request_body': json.loads(body) if body else None,
                        'timestamp': time.time(),
                    }
                # Important: recreate request with body for downstream
                request = Request(request.scope, receive=self._create_receive(body))
            except Exception:
                pass
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration = time.time() - start_time
        
        # Log write operations
        if request.method in self.WRITE_METHODS and response.status_code < 400:
            self._log_write_action(
                request=request,
                response=response,
                user_id=user_id,
                duration=duration,
                before_state=before_state,
            )
        
        return response

    def _create_receive(self, body: bytes):
        """Create receive function that returns cached body."""
        async def receive():
            return {"type": "http.request", "body": body}
        return receive

    def _log_write_action(
        self,
        request: Request,
        response: Response,
        user_id: int | None,
        duration: float,
        before_state: dict | None,
    ) -> None:
        """Log write action to audit log."""
        db = SessionLocal()
        try:
            # Extract resource info from path
            path_parts = request.url.path.split('/')
            resource_type = path_parts[3] if len(path_parts) > 3 else 'unknown'
            resource_id = path_parts[4] if len(path_parts) > 4 else None
            
            # Determine action
            action = self._determine_action(request.method, resource_type)
            
            # Build details
            details = {
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code,
                'duration_ms': round(duration * 1000, 2),
                'ip_address': request.client.host if request.client else None,
                'user_agent': request.headers.get('user-agent'),
            }
            
            # Add before state for updates/deletes
            if before_state and request.method in ['PUT', 'PATCH', 'DELETE']:
                details['before'] = before_state
            
            # Create audit log entry
            audit_log = AuditLog(
                action=action,
                user_id=user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
            )
            
            db.add(audit_log)
            db.commit()
        except Exception as e:
            # Don't fail the request if audit logging fails
            print(f"Audit logging error: {e}")
        finally:
            db.close()

    def _determine_action(self, method: str, resource_type: str) -> str:
        """Determine action name from method and resource."""
        method_map = {
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }
        
        action = method_map.get(method, 'unknown')
        return f"{resource_type}_{action}"


def create_audit_log(
    action: str,
    user_id: int | None,
    resource_type: str,
    resource_id: str | None,
    before: dict | None = None,
    after: dict | None = None,
    details: dict | None = None,
) -> None:
    """
    Create audit log entry with before/after state.
    
    Usage:
        create_audit_log(
            action='incident_updated',
            user_id=user.id,
            resource_type='incident',
            resource_id=str(incident.id),
            before={'status': 'new'},
            after={'status': 'investigating'},
        )
    """
    db = SessionLocal()
    try:
        full_details = details or {}
        
        if before:
            full_details['before'] = before
        if after:
            full_details['after'] = after
        
        # Calculate changes
        if before and after:
            changes = {}
            for key in set(before.keys()) | set(after.keys()):
                before_val = before.get(key)
                after_val = after.get(key)
                if before_val != after_val:
                    changes[key] = {
                        'from': before_val,
                        'to': after_val,
                    }
            if changes:
                full_details['changes'] = changes
        
        audit_log = AuditLog(
            action=action,
            user_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details=full_details,
        )
        
        db.add(audit_log)
        db.commit()
    finally:
        db.close()
