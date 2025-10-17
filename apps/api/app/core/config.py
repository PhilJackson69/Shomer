"""Application configuration."""
from typing import Any

from pydantic import PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings."""

    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    API_V1_STR: str = "/api/v1"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_SECRET_KEY: str

    # Database
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_URL: PostgresDsn

    # Redis
    REDIS_URL: RedisDsn

    # JWT
    JWT_SECRET: str
    JWT_EXPIRES_IN: int = 3600
    JWT_ALGORITHM: str = "HS256"

    # Notifications (optional)
    TWILIO_ACCOUNT_SID: str | None = None
    TWILIO_AUTH_TOKEN: str | None = None
    TWILIO_FROM_NUMBER: str | None = None
    SENDGRID_API_KEY: str | None = None

    # Ingestion (optional)
    X_BEARER_TOKEN: str | None = None
    NEWSAPI_KEY: str | None = None

    # Storage (S3-compatible for production, local for dev)
    STORAGE_TYPE: str = "local"  # "local" or "s3"
    STORAGE_LOCAL_PATH: str = "uploads"
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_S3_BUCKET: str | None = None
    AWS_REGION: str = "us-east-1"
    
    # Retention
    TIP_RETENTION_DAYS: int = 14
    ENABLE_RETENTION_SCHEDULER: bool = True
    
    # Feature Flags
    FEATURE_EVIDENCE: bool = False  # Enable secure evidence submission & chain-of-custody
    
    # Environment
    ENVIRONMENT: str = "development"  # development or production
    
    # Web origin (for CORS in production)
    WEB_ORIGIN: str | None = None
    
    # Public base URL for signed URLs
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    
    # Signed URL security (Phase 2.5 Hardening)
    SIGNED_URL_SECRET: str = "dev_change_me"
    SIGNED_URL_DEFAULT_TTL_SECONDS: int = 600  # 10 minutes
    
    # OpenTelemetry (observability)
    OTEL_ENABLED: bool = False
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "shomer-api"
    
    # Git SHA (for deployment tracking)
    GIT_SHA: str | None = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: Any) -> str:
        """Validate database URL."""
        if isinstance(v, str):
            return v
        return str(v)

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def validate_redis_url(cls, v: Any) -> str:
        """Validate Redis URL."""
        if isinstance(v, str):
            return v
        return str(v)


settings = Settings()  # type: ignore

