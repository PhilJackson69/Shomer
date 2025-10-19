"""
Security metrics and monitoring for production hardening.
"""

import time
import logging
from functools import wraps
from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest
import hashlib

# Security event counters
security_events_total = Counter(
    'security_events_total',
    'Total number of security events',
    ['event_type', 'severity', 'user_id']
)

security_token_verification_total = Counter(
    'security_token_verification_total',
    'Total number of token verification attempts',
    ['status', 'algorithm']
)

security_token_verification_errors_total = Counter(
    'security_token_verification_errors_total',
    'Total number of token verification errors',
    ['error_type', 'algorithm']
)

security_refresh_token_reuse_total = Counter(
    'security_refresh_token_reuse_total',
    'Total number of refresh token reuse attempts',
    ['user_id', 'ip_hash']
)

security_algorithm_confusion_attempts_total = Counter(
    'security_algorithm_confusion_attempts_total',
    'Total number of algorithm confusion attempts',
    ['algorithm', 'ip_hash']
)

security_key_rotation_total = Counter(
    'security_key_rotation_total',
    'Total number of key rotation attempts',
    ['status']
)

security_key_rotation_failures_total = Counter(
    'security_key_rotation_failures_total',
    'Total number of key rotation failures',
    ['error_type']
)

# Security timing metrics
security_event_processing_duration = Histogram(
    'security_event_processing_duration_seconds',
    'Time spent processing security events',
    ['event_type']
)

security_token_verification_duration = Histogram(
    'security_token_verification_duration_seconds',
    'Time spent verifying tokens',
    ['algorithm', 'status']
)

# Security state metrics
security_clock_skew_seconds = Gauge(
    'security_clock_skew_seconds',
    'Current clock skew in seconds'
)

security_active_keys_count = Gauge(
    'security_active_keys_count',
    'Number of active JWT keys'
)

security_last_key_rotation_timestamp = Gauge(
    'security_last_key_rotation_timestamp_seconds',
    'Timestamp of last key rotation'
)

# Authentication metrics
auth_attempts_total = Counter(
    'auth_attempts_total',
    'Total number of authentication attempts',
    ['method', 'status', 'ip_hash']
)

auth_sessions_revoked_total = Counter(
    'auth_sessions_revoked_total',
    'Total number of sessions revoked',
    ['reason', 'user_id']
)

# Rate limiting metrics
rate_limit_hits_total = Counter(
    'rate_limit_hits_total',
    'Total number of rate limit hits',
    ['endpoint', 'ip_hash']
)

# Security headers metrics
security_headers_missing_total = Counter(
    'security_headers_missing_total',
    'Total number of missing security headers',
    ['header_name', 'endpoint']
)

# MFA metrics
mfa_enforcement_decisions_total = Counter(
    'mfa_enforcement_decisions_total',
    'Total number of MFA enforcement decisions',
    ['mode', 'percent', 'cohort_source', 'user_role', 'reason', 'enforced']
)

mfa_enforcement_blocked_total = Counter(
    'mfa_enforcement_blocked_total',
    'Total number of MFA enforcement blocks',
    ['mode', 'reason']
)

mfa_enforcement_allowed_total = Counter(
    'mfa_enforcement_allowed_total',
    'Total number of MFA enforcement allowances',
    ['mode', 'reason']
)

mfa_enforcement_would_block_total = Counter(
    'mfa_enforcement_would_block_total',
    'Total number of MFA enforcement would-block decisions (dryrun)',
    ['mode', 'reason']
)

mfa_totp_verify_total = Counter(
    'mfa_totp_verify_total',
    'Total number of TOTP verification attempts',
    ['status', 'failure_reason']
)

mfa_recovery_verify_total = Counter(
    'mfa_recovery_verify_total',
    'Total number of recovery code verification attempts',
    ['status', 'failure_reason']
)

mfa_webauthn_verify_total = Counter(
    'mfa_webauthn_verify_total',
    'Total number of WebAuthn verification attempts',
    ['status', 'failure_reason']
)

mfa_api_latency_seconds = Histogram(
    'mfa_api_latency_seconds',
    'MFA API endpoint latency',
    ['route', 'method', 'status']
)


def hash_ip(ip: str) -> str:
    """Hash IP address for privacy."""
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


def hash_user_agent(ua: str) -> str:
    """Hash user agent for privacy."""
    return hashlib.sha256(ua.encode()).hexdigest()[:16]


def log_security_event(
    event_type: str,
    severity: str,
    user_id: Optional[str] = None,
    ip_hash: Optional[str] = None,
    ua_hash: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """
    Log a security event with metrics.
    
    Args:
        event_type: Type of security event
        severity: Severity level (LOW, MEDIUM, HIGH, CRITICAL)
        user_id: User ID if applicable
        ip_hash: Hashed IP address
        ua_hash: Hashed user agent
        details: Additional event details
    """
    # Increment counter
    security_events_total.labels(
        event_type=event_type,
        severity=severity,
        user_id=user_id or 'unknown'
    ).inc()
    
    # Log the event
    logger = logging.getLogger(__name__)
    log_data = {
        'event_type': event_type,
        'severity': severity,
        'user_id': user_id,
        'ip_hash': ip_hash,
        'ua_hash': ua_hash,
        'timestamp': time.time(),
        'details': details or {}
    }
    
    if severity in ['HIGH', 'CRITICAL']:
        logger.warning(f"SECURITY_EVENT: {event_type}", extra=log_data)
    else:
        logger.info(f"Security event: {event_type}", extra=log_data)


def record_token_verification(
    algorithm: str,
    status: str,
    duration: float,
    error_type: Optional[str] = None
):
    """
    Record token verification metrics.
    
    Args:
        algorithm: JWT algorithm used
        status: Verification status (success, failure)
        duration: Verification duration in seconds
        error_type: Type of error if verification failed
    """
    security_token_verification_total.labels(
        algorithm=algorithm,
        status=status
    ).inc()
    
    security_token_verification_duration.labels(
        algorithm=algorithm,
        status=status
    ).observe(duration)
    
    if status == 'failure' and error_type:
        security_token_verification_errors_total.labels(
            error_type=error_type,
            algorithm=algorithm
        ).inc()


def record_refresh_token_reuse(user_id: str, ip_hash: str):
    """
    Record refresh token reuse attempt.
    
    Args:
        user_id: User ID
        ip_hash: Hashed IP address
    """
    security_refresh_token_reuse_total.labels(
        user_id=user_id,
        ip_hash=ip_hash
    ).inc()
    
    log_security_event(
        event_type="refresh_token_reuse",
        severity="HIGH",
        user_id=user_id,
        ip_hash=ip_hash,
        details={"action": "revoke_all_sessions"}
    )


def record_algorithm_confusion_attempt(algorithm: str, ip_hash: str):
    """
    Record algorithm confusion attack attempt.
    
    Args:
        algorithm: Algorithm used in attack
        ip_hash: Hashed IP address
    """
    security_algorithm_confusion_attempts_total.labels(
        algorithm=algorithm,
        ip_hash=ip_hash
    ).inc()
    
    log_security_event(
        event_type="algorithm_confusion_attempt",
        severity="CRITICAL",
        ip_hash=ip_hash,
        details={"algorithm": algorithm}
    )


def record_key_rotation(status: str, error_type: Optional[str] = None):
    """
    Record key rotation attempt.
    
    Args:
        status: Rotation status (success, failure)
        error_type: Type of error if rotation failed
    """
    security_key_rotation_total.labels(status=status).inc()
    
    if status == 'success':
        security_last_key_rotation_timestamp.set(time.time())
    elif status == 'failure' and error_type:
        security_key_rotation_failures_total.labels(error_type=error_type).inc()


def record_auth_attempt(method: str, status: str, ip_hash: str):
    """
    Record authentication attempt.
    
    Args:
        method: Authentication method
        status: Attempt status (success, failure)
        ip_hash: Hashed IP address
    """
    auth_attempts_total.labels(
        method=method,
        status=status,
        ip_hash=ip_hash
    ).inc()


def record_session_revocation(reason: str, user_id: str):
    """
    Record session revocation.
    
    Args:
        reason: Reason for revocation
        user_id: User ID
    """
    auth_sessions_revoked_total.labels(
        reason=reason,
        user_id=user_id
    ).inc()


def record_rate_limit_hit(endpoint: str, ip_hash: str):
    """
    Record rate limit hit.
    
    Args:
        endpoint: Endpoint that was rate limited
        ip_hash: Hashed IP address
    """
    rate_limit_hits_total.labels(
        endpoint=endpoint,
        ip_hash=ip_hash
    ).inc()


def record_missing_security_header(header_name: str, endpoint: str):
    """
    Record missing security header.
    
    Args:
        header_name: Name of missing header
        endpoint: Endpoint missing the header
    """
    security_headers_missing_total.labels(
        header_name=header_name,
        endpoint=endpoint
    ).inc()


def update_clock_skew(skew_seconds: float):
    """
    Update clock skew metric.
    
    Args:
        skew_seconds: Clock skew in seconds
    """
    security_clock_skew_seconds.set(skew_seconds)


def update_active_keys_count(count: int):
    """
    Update active keys count metric.
    
    Args:
        count: Number of active keys
    """
    security_active_keys_count.set(count)


def record_mfa_enforcement_decision(enforced: bool, reason: str, labels: dict):
    """
    Record MFA enforcement decision.
    
    Args:
        enforced: Whether MFA was enforced
        reason: Reason for the decision
        labels: Additional labels for the metric
    """
    # Record the decision
    mfa_enforcement_decisions_total.labels(**labels).inc()
    
    # Record specific outcomes
    if enforced:
        mfa_enforcement_blocked_total.labels(
            mode=labels.get('mode', 'unknown'),
            reason=reason
        ).inc()
    else:
        mfa_enforcement_allowed_total.labels(
            mode=labels.get('mode', 'unknown'),
            reason=reason
        ).inc()
        
        # In dryrun mode, also record would-block decisions
        if labels.get('mode') == 'dryrun' and reason.startswith('dryrun_'):
            actual_reason = reason.replace('dryrun_', '')
            if actual_reason in ['cohort_member', 'percent_', 'full_enforcement']:
                mfa_enforcement_would_block_total.labels(
                    mode=labels.get('mode', 'unknown'),
                    reason=actual_reason
                ).inc()


def record_mfa_totp_verification(status: str, failure_reason: str = None):
    """
    Record TOTP verification attempt.
    
    Args:
        status: Verification status (success, failure)
        failure_reason: Reason for failure if applicable
    """
    mfa_totp_verify_total.labels(
        status=status,
        failure_reason=failure_reason or 'none'
    ).inc()


def record_mfa_recovery_verification(status: str, failure_reason: str = None):
    """
    Record recovery code verification attempt.
    
    Args:
        status: Verification status (success, failure)
        failure_reason: Reason for failure if applicable
    """
    mfa_recovery_verify_total.labels(
        status=status,
        failure_reason=failure_reason or 'none'
    ).inc()


def record_mfa_webauthn_verification(status: str, failure_reason: str = None):
    """
    Record WebAuthn verification attempt.
    
    Args:
        status: Verification status (success, failure)
        failure_reason: Reason for failure if applicable
    """
    mfa_webauthn_verify_total.labels(
        status=status,
        failure_reason=failure_reason or 'none'
    ).inc()


def record_mfa_api_latency(route: str, method: str, status: str, duration: float):
    """
    Record MFA API endpoint latency.
    
    Args:
        route: API route
        method: HTTP method
        status: Response status
        duration: Request duration in seconds
    """
    mfa_api_latency_seconds.labels(
        route=route,
        method=method,
        status=status
    ).observe(duration)


def security_event_timer(event_type: str):
    """
    Decorator to time security event processing.
    
    Args:
        event_type: Type of security event
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                security_event_processing_duration.labels(
                    event_type=event_type
                ).observe(duration)
        return wrapper
    return decorator


def get_security_metrics() -> str:
    """
    Get security metrics in Prometheus format.
    
    Returns:
        Metrics in Prometheus format
    """
    return generate_latest()


def get_security_metrics_summary() -> Dict[str, Any]:
    """
    Get security metrics summary for monitoring dashboards.
    
    Returns:
        Dictionary with security metrics summary
    """
    return {
        "security_events": {
            "total": security_events_total._value.sum(),
            "by_severity": {
                "LOW": security_events_total.labels(severity="LOW")._value.sum(),
                "MEDIUM": security_events_total.labels(severity="MEDIUM")._value.sum(),
                "HIGH": security_events_total.labels(severity="HIGH")._value.sum(),
                "CRITICAL": security_events_total.labels(severity="CRITICAL")._value.sum(),
            }
        },
        "token_verification": {
            "total": security_token_verification_total._value.sum(),
            "success_rate": (
                security_token_verification_total.labels(status="success")._value.sum() /
                security_token_verification_total._value.sum() * 100
                if security_token_verification_total._value.sum() > 0 else 0
            )
        },
        "refresh_token_reuse": {
            "total": security_refresh_token_reuse_total._value.sum()
        },
        "algorithm_confusion": {
            "total": security_algorithm_confusion_attempts_total._value.sum()
        },
        "key_rotation": {
            "total": security_key_rotation_total._value.sum(),
            "success_rate": (
                security_key_rotation_total.labels(status="success")._value.sum() /
                security_key_rotation_total._value.sum() * 100
                if security_key_rotation_total._value.sum() > 0 else 0
            )
        },
        "clock_skew": {
            "current_seconds": security_clock_skew_seconds._value.get()
        },
        "active_keys": {
            "count": security_active_keys_count._value.get()
        }
    }