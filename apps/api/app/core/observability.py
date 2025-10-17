"""
Observability setup for distributed tracing and logging.

Configures OpenTelemetry for:
- Distributed tracing across services
- Request/response logging with correlation IDs
- Performance monitoring
- Error tracking
"""

import logging
import sys
from typing import Optional

try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.instrumentation.redis import RedisInstrumentor
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    trace = None

from app.core.config import settings


def setup_logging(log_level: str = "INFO"):
    """
    Configure structured logging with request IDs and trace correlation.
    
    Logs include:
    - Request ID for correlation
    - User ID for audit
    - Evidence ID for evidence operations
    - Trace ID (OpenTelemetry) for distributed tracing
    - Span ID (OpenTelemetry) for span correlation
    - Timestamp (ISO-8601 UTC)
    - Log level
    - Message
    """
    
    # Custom log format with request ID and trace IDs
    log_format = (
        "%(asctime)s | %(levelname)-8s | "
        "%(request_id)s | %(trace_id)s | %(span_id)s | "
        "%(user_id)s | %(evidence_id)s | "
        "%(name)s | %(message)s"
    )
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        datefmt="%Y-%m-%dT%H:%M:%S%z",  # ISO-8601
        stream=sys.stdout,
    )
    
    # Add default values for custom fields
    old_factory = logging.getLogRecordFactory()
    
    def record_factory(*args, **kwargs):
        record = old_factory(*args, **kwargs)
        
        # Add default values for custom fields
        if not hasattr(record, 'request_id'):
            record.request_id = '-'
        if not hasattr(record, 'user_id'):
            record.user_id = '-'
        if not hasattr(record, 'evidence_id'):
            record.evidence_id = '-'
        
        # Add OpenTelemetry trace context if available
        if OTEL_AVAILABLE and trace:
            try:
                span = trace.get_current_span()
                if span and span.is_recording():
                    ctx = span.get_span_context()
                    record.trace_id = format(ctx.trace_id, '032x')
                    record.span_id = format(ctx.span_id, '016x')
                else:
                    record.trace_id = '-'
                    record.span_id = '-'
            except Exception:
                record.trace_id = '-'
                record.span_id = '-'
        else:
            record.trace_id = '-'
            record.span_id = '-'
        
        return record
    
    logging.setLogRecordFactory(record_factory)
    
    return logging.getLogger("shomer")


def setup_opentelemetry(app = None) -> Optional[trace.Tracer]:
    """
    Configure OpenTelemetry for distributed tracing.
    
    Exports traces to OTLP-compatible backend (Jaeger, Tempo, etc.)
    
    Environment variables:
    - OTEL_EXPORTER_OTLP_ENDPOINT: Endpoint for OTLP exporter
    - OTEL_SERVICE_NAME: Service name for traces
    - OTEL_ENABLED: Enable/disable OpenTelemetry
    """
    
    if not OTEL_AVAILABLE:
        print("⚠ OpenTelemetry not installed - tracing disabled")
        print("  Install with: pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp")
        return None
    
    # Check if enabled
    otel_enabled = getattr(settings, 'OTEL_ENABLED', False)
    if not otel_enabled:
        print("ℹ OpenTelemetry disabled (set OTEL_ENABLED=true to enable)")
        return None
    
    # Get configuration
    otel_endpoint = getattr(settings, 'OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4317')
    service_name = getattr(settings, 'OTEL_SERVICE_NAME', 'shomer-api')
    
    try:
        # Create resource with service information
        resource = Resource(attributes={
            SERVICE_NAME: service_name,
            SERVICE_VERSION: "1.0.0",
            "deployment.environment": settings.ENVIRONMENT,
        })
        
        # Create tracer provider
        provider = TracerProvider(resource=resource)
        
        # Create OTLP exporter
        otlp_exporter = OTLPSpanExporter(
            endpoint=otel_endpoint,
            insecure=True,  # Use TLS in production
        )
        
        # Add batch span processor
        processor = BatchSpanProcessor(otlp_exporter)
        provider.add_span_processor(processor)
        
        # Set global tracer provider
        trace.set_tracer_provider(provider)
        
        # Instrument FastAPI
        if app:
            FastAPIInstrumentor.instrument_app(app)
        
        # Instrument SQLAlchemy (if available)
        try:
            from app.db.base import engine
            SQLAlchemyInstrumentor().instrument(engine=engine)
        except Exception:
            pass
        
        # Instrument Redis (if available)
        try:
            RedisInstrumentor().instrument()
        except Exception:
            pass
        
        print(f"✓ OpenTelemetry configured - exporting to {otel_endpoint}")
        
        return trace.get_tracer(__name__)
        
    except Exception as e:
        print(f"✗ Failed to configure OpenTelemetry: {e}")
        return None


def get_tracer() -> Optional[trace.Tracer]:
    """Get the application tracer."""
    if OTEL_AVAILABLE and trace:
        return trace.get_tracer(__name__)
    return None


def extract_request_id(headers: dict) -> Optional[str]:
    """
    Extract request ID from headers.
    
    Looks for X-Request-ID header (or similar variations).
    
    Args:
        headers: Request headers dict
        
    Returns:
        Request ID if found, None otherwise
    """
    request_id_headers = [
        'x-request-id',
        'x-correlation-id',
        'request-id',
    ]
    
    # Normalize headers to lowercase for lookup
    normalized_headers = {k.lower(): v for k, v in headers.items()}
    
    for header in request_id_headers:
        if header in normalized_headers:
            return normalized_headers[header]
    
    return None


def create_span_with_request_id(operation_name: str, request_id: Optional[str] = None):
    """
    Create a span and attach request ID as an attribute.
    
    This helps correlate traces with request IDs in logs.
    
    Args:
        operation_name: Name of the operation
        request_id: Request ID from headers
        
    Returns:
        Context manager for the span
    """
    tracer = get_tracer()
    
    if not tracer:
        # Return a no-op context manager
        from contextlib import nullcontext
        return nullcontext()
    
    span = tracer.start_as_current_span(operation_name)
    
    # Add request ID as span attribute
    if request_id:
        try:
            current_span = trace.get_current_span()
            if current_span and current_span.is_recording():
                current_span.set_attribute("request.id", request_id)
        except Exception:
            pass
    
    return span


def trace_evidence_operation(operation: str):
    """
    Decorator to trace evidence operations.
    
    Usage:
        @trace_evidence_operation("upload")
        async def upload_evidence(...):
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            tracer = get_tracer()
            if not tracer:
                return await func(*args, **kwargs)
            
            with tracer.start_as_current_span(f"evidence.{operation}") as span:
                # Add custom attributes
                span.set_attribute("evidence.operation", operation)
                
                # Extract evidence ID from kwargs if available
                evidence_id = kwargs.get('evidence_id')
                if evidence_id:
                    span.set_attribute("evidence.id", evidence_id)
                
                try:
                    result = await func(*args, **kwargs)
                    span.set_attribute("status", "success")
                    return result
                except Exception as e:
                    span.set_attribute("status", "error")
                    span.set_attribute("error.message", str(e))
                    span.record_exception(e)
                    raise
        
        return wrapper
    return decorator


# Alert definitions for monitoring
ALERTS = {
    "high_5xx": {
        "name": "High 5xx Error Rate",
        "description": "5xx errors exceed 5% of requests",
        "query": "rate(http_requests_total{status=~'5..'}[5m]) > 0.05",
        "severity": "critical",
    },
    "verify_failures": {
        "name": "Evidence Verification Failures",
        "description": "Spike in evidence verification failures",
        "query": "increase(evidence_verify_failure_total[5m]) > 10",
        "severity": "high",
    },
    "export_volume": {
        "name": "High Export Volume",
        "description": "Unusual spike in chain-of-custody exports",
        "query": "rate(evidence_export_total[5m]) > 50",
        "severity": "warning",
    },
}


def get_alerts_config() -> dict:
    """Get alert configurations for Prometheus/Grafana."""
    return ALERTS


def enrich_log_with_trace(logger: logging.Logger, message: str, level: str = "info", **kwargs):
    """
    Log a message with automatic trace context enrichment.
    
    Automatically adds trace_id and span_id from current OpenTelemetry span.
    
    Args:
        logger: Logger instance
        message: Log message
        level: Log level (info, warning, error, etc.)
        **kwargs: Additional context to include in log
        
    Example:
        enrich_log_with_trace(
            logger,
            "Evidence uploaded",
            level="info",
            evidence_id=evidence.id,
            file_size=file_size
        )
    """
    # Get current span context if available
    extra = kwargs.copy()
    
    if OTEL_AVAILABLE and trace:
        try:
            span = trace.get_current_span()
            if span and span.is_recording():
                ctx = span.get_span_context()
                extra['trace_id'] = format(ctx.trace_id, '032x')
                extra['span_id'] = format(ctx.span_id, '016x')
        except Exception:
            pass
    
    # Get log method
    log_method = getattr(logger, level.lower(), logger.info)
    log_method(message, extra=extra)

