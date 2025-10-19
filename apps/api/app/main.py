"""Main FastAPI application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler
from app.core.startup import startup_ingestion_scheduler
from app.core.security import log_security_warnings
from fastapi import Request
from app.core.error_handling import setup_error_handlers
from app.middleware.audit import AuditLoggingMiddleware
from app.middleware.rate_limit import RateLimitMiddleware, get_redis_client
from app.middleware.csrf import CSRFProtectionMiddleware
from app.middleware.idempotency import IdempotencyMiddleware
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware, LoggingRedactionMiddleware
from app.core.observability import setup_logging, setup_opentelemetry

# Global Redis client for rate limiting
redis_client = None

# Setup logging
logger = setup_logging(log_level="INFO" if settings.ENVIRONMENT == "production" else "DEBUG")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global redis_client
    
    # Startup
    logger.info("Starting Shomer API", extra={'request_id': 'startup', 'user_id': '-', 'evidence_id': '-'})
    
    # Validate security configuration
    log_security_warnings()
    
    start_scheduler()
    startup_ingestion_scheduler()
    
    # Initialize Redis for rate limiting
    redis_client = await get_redis_client()
    if redis_client:
        logger.info("Redis connected for rate limiting")
    else:
        logger.warning("Redis not available - rate limiting disabled")
    
    # Setup OpenTelemetry
    setup_opentelemetry(app)
    
    logger.info(f"Shomer API started (env={settings.ENVIRONMENT}, git_sha={settings.GIT_SHA or 'unknown'})")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Shomer API")
    stop_scheduler()
    if redis_client:
        await redis_client.close()
    # Note: Ingestion scheduler cleanup handled by APScheduler


app = FastAPI(
    title="Shomer API",
    description="Production-ready API with RBAC and auditing",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# Determine CORS origins based on environment
allowed_origins = ["http://localhost:3000"]  # Default for development
if settings.ENVIRONMENT == "production":
    # Lock down CORS to specific web origin(s)
    allowed_origins = [
        "https://shomer.app",
        "https://www.shomer.app",
    ]
    # Add custom domain if configured
    if hasattr(settings, 'WEB_ORIGIN'):
        allowed_origins.append(settings.WEB_ORIGIN)

# CORS middleware - MUST be added first
from app.middleware.security_headers import setup_cors_middleware
setup_cors_middleware(
    app, 
    allowed_origins=allowed_origins, 
    is_production=(settings.ENVIRONMENT == "production")
)

# HTTPS trust check middleware (for production)
if settings.ENVIRONMENT == "production":
    @app.middleware("http")
    async def https_trust_check(request: Request, call_next):
        """Ensure HTTPS is properly configured via proxy headers."""
        forwarded_proto = request.headers.get("x-forwarded-proto", "https")
        if forwarded_proto != "https":
            logger.error(f"Proxy misconfig: not HTTPS (got {forwarded_proto})")
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="HTTPS required")
        return await call_next(request)

# Request ID middleware (for tracing)
app.add_middleware(RequestIDMiddleware)

# Logging redaction middleware (must be early in the stack)
app.add_middleware(LoggingRedactionMiddleware)

# Security headers middleware
app.add_middleware(
    SecurityHeadersMiddleware,
    enable_hsts=(settings.ENVIRONMENT == "production"),
    is_production=(settings.ENVIRONMENT == "production")
)

# CSRF protection middleware (for production)
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        CSRFProtectionMiddleware,
        secret_key=settings.API_SECRET_KEY
    )

# CSRF -> Idempotency -> RateLimit to ensure dedupe before blocking bursts
app.add_middleware(IdempotencyMiddleware, redis_client=redis_client)
app.add_middleware(RateLimitMiddleware, redis_client=redis_client)

# Audit logging middleware
app.add_middleware(AuditLoggingMiddleware)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Set up error handlers
setup_error_handlers(app)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {"message": "Shomer API - See /docs for API documentation"}

