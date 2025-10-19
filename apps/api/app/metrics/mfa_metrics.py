"""MFA Metrics Collection for Prometheus."""

import time
from typing import Dict, Optional
from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry

# MFA Metrics Registry
mfa_registry = CollectorRegistry()

# MFA Setup Metrics
mfa_setup_total = Counter(
    'mfa_setup_total',
    'Total MFA setups completed',
    ['method', 'status'],
    registry=mfa_registry
)

mfa_setup_duration_seconds = Histogram(
    'mfa_setup_duration_seconds',
    'Time taken to complete MFA setup',
    ['method'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0],
    registry=mfa_registry
)

# MFA Verification Metrics
mfa_verify_total = Counter(
    'mfa_verify_total',
    'Total MFA verification attempts',
    ['method', 'status'],
    registry=mfa_registry
)

mfa_verify_duration_seconds = Histogram(
    'mfa_verify_duration_seconds',
    'Time taken for MFA verification',
    ['method'],
    buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0],
    registry=mfa_registry
)

# End-to-End MFA Metrics
mfa_end_to_end_seconds = Histogram(
    'mfa_end_to_end_seconds',
    'End-to-end time from MFA setup to first successful verification',
    ['method'],
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0, 1800.0, 3600.0],
    registry=mfa_registry
)

# MFA Enforcement Metrics
mfa_enforcement_decisions_total = Counter(
    'mfa_enforcement_decisions_total',
    'Total MFA enforcement decisions',
    ['mode', 'enforced'],
    registry=mfa_registry
)

mfa_enforcement_blocked_total = Counter(
    'mfa_enforcement_blocked_total',
    'Total MFA enforcement blocks',
    ['mode', 'reason'],
    registry=mfa_registry
)

# MFA Rate Limiting Metrics
mfa_rate_limit_hits_total = Counter(
    'mfa_rate_limit_hits_total',
    'Total MFA rate limit hits',
    ['endpoint'],
    registry=mfa_registry
)

# MFA Security Metrics
mfa_security_events_total = Counter(
    'mfa_security_events_total',
    'Total MFA security events',
    ['event_type', 'severity'],
    registry=mfa_registry
)

mfa_totp_reuse_window_hits = Counter(
    'mfa_totp_reuse_window_hits_total',
    'Total TOTP reuse window hits (replay attacks)',
    registry=mfa_registry
)

# MFA API Latency Metrics
mfa_api_latency_seconds = Histogram(
    'mfa_api_latency_seconds',
    'MFA API endpoint latency',
    ['endpoint', 'method'],
    buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0],
    registry=mfa_registry
)

# MFA Recovery Code Metrics
mfa_recovery_verify_total = Counter(
    'mfa_recovery_verify_total',
    'Total recovery code verification attempts',
    ['status'],
    registry=mfa_registry
)

# MFA WebAuthn Metrics
mfa_webauthn_verify_total = Counter(
    'mfa_webauthn_verify_total',
    'Total WebAuthn verification attempts',
    ['status'],
    registry=mfa_registry
)

# MFA TOTP Metrics
mfa_totp_verify_total = Counter(
    'mfa_totp_verify_total',
    'Total TOTP verification attempts',
    ['status'],
    registry=mfa_registry
)


class MFAMetricsCollector:
    """Collector for MFA metrics with timing context."""
    
    def __init__(self):
        self.start_times: Dict[str, float] = {}
    
    def start_timing(self, operation_id: str) -> None:
        """Start timing an operation."""
        self.start_times[operation_id] = time.time()
    
    def record_setup(self, method: str, status: str, operation_id: Optional[str] = None) -> None:
        """Record MFA setup completion."""
        mfa_setup_total.labels(method=method, status=status).inc()
        
        if operation_id and operation_id in self.start_times:
            duration = time.time() - self.start_times[operation_id]
            mfa_setup_duration_seconds.labels(method=method).observe(duration)
            del self.start_times[operation_id]
    
    def record_verification(self, method: str, status: str, operation_id: Optional[str] = None) -> None:
        """Record MFA verification attempt."""
        mfa_verify_total.labels(method=method, status=status).inc()
        
        if operation_id and operation_id in self.start_times:
            duration = time.time() - self.start_times[operation_id]
            mfa_verify_duration_seconds.labels(method=method).observe(duration)
            del self.start_times[operation_id]
    
    def record_end_to_end(self, method: str, duration_seconds: float) -> None:
        """Record end-to-end MFA timing (setup to first successful verification)."""
        mfa_end_to_end_seconds.labels(method=method).observe(duration_seconds)
    
    def record_enforcement_decision(self, mode: str, enforced: bool) -> None:
        """Record MFA enforcement decision."""
        mfa_enforcement_decisions_total.labels(mode=mode, enforced=str(enforced)).inc()
    
    def record_enforcement_block(self, mode: str, reason: str) -> None:
        """Record MFA enforcement block."""
        mfa_enforcement_blocked_total.labels(mode=mode, reason=reason).inc()
    
    def record_rate_limit_hit(self, endpoint: str) -> None:
        """Record rate limit hit."""
        mfa_rate_limit_hits_total.labels(endpoint=endpoint).inc()
    
    def record_security_event(self, event_type: str, severity: str) -> None:
        """Record security event."""
        mfa_security_events_total.labels(event_type=event_type, severity=severity).inc()
    
    def record_totp_reuse_hit(self) -> None:
        """Record TOTP reuse window hit (replay attack)."""
        mfa_totp_reuse_window_hits.inc()
    
    def record_api_latency(self, endpoint: str, method: str, duration_seconds: float) -> None:
        """Record API latency."""
        mfa_api_latency_seconds.labels(endpoint=endpoint, method=method).observe(duration_seconds)


# Global metrics collector instance
mfa_metrics = MFAMetricsCollector()


def get_mfa_metrics_registry():
    """Get the MFA metrics registry."""
    return mfa_registry


def record_mfa_setup_start(user_id: int, method: str) -> str:
    """Record MFA setup start and return operation ID."""
    operation_id = f"setup_{user_id}_{method}_{int(time.time())}"
    mfa_metrics.start_timing(operation_id)
    return operation_id


def record_mfa_verification_start(user_id: int, method: str) -> str:
    """Record MFA verification start and return operation ID."""
    operation_id = f"verify_{user_id}_{method}_{int(time.time())}"
    mfa_metrics.start_timing(operation_id)
    return operation_id


def record_mfa_end_to_end_time(user_id: int, method: str, duration_seconds: float) -> None:
    """Record end-to-end MFA timing."""
    mfa_metrics.record_end_to_end(method, duration_seconds)
