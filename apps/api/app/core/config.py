"""Application configuration."""
import secrets
import re
from typing import Any

from pydantic import PostgresDsn, RedisDsn, field_validator, ValidationError
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
    
    # JWT Key Management (for asymmetric algorithms)
    JWT_PRIVATE_KEY: str | None = None
    JWT_PUBLIC_KEY: str | None = None
    JWT_ALG: str | None = None  # Override JWT_ALGORITHM for production
    
    # KMS/HSM Integration (optional)
    KMS_ENABLED: bool = False
    KMS_KEY_ID: str | None = None  # AWS KMS key ID for signing
    AWS_REGION: str = "us-east-1"

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
    
    # MFA Configuration
    MFA_ENFORCE_ADMINS: bool = True
    MFA_TEST_MODE: bool = False  # Enable test mode for CI
    TOTP_ISSUER: str = "Shomer"
    TOTP_WINDOW: int = 1  # Time window tolerance for TOTP codes
    
    # MFA Rollout Configuration
    MFA_ROLLOUT_MODE: str = "off"  # off|dryrun|cohorts|percent|on
    MFA_PERCENT: int = 0  # 0-100, only used when MODE=percent
    MFA_COHORT_SOURCE: str = "env"  # db|env
    MFA_COHORT_USER_IDS: str = ""  # Comma-separated user IDs for env fallback

    @field_validator("API_SECRET_KEY", mode="before")
    @classmethod
    def validate_api_secret_key(cls, v: str) -> str:
        """Validate API secret key strength."""
        if not v or len(v) < 32:
            raise ValueError("API_SECRET_KEY must be at least 32 characters long")
        if v in ["devsecret_change_me_in_production", "dev_change_me", "change_me", "secret"]:
            raise ValueError("API_SECRET_KEY must not use default/placeholder values")
        return v

    @field_validator("JWT_SECRET", mode="before")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        """Validate JWT secret strength."""
        if not v or len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long")
        if v in ["devjwt_change_me_in_production", "dev_change_me", "change_me", "secret"]:
            raise ValueError("JWT_SECRET must not use default/placeholder values")
        return v

    @field_validator("SIGNED_URL_SECRET", mode="before")
    @classmethod
    def validate_signed_url_secret(cls, v: str) -> str:
        """Validate signed URL secret strength."""
        if not v or len(v) < 32:
            raise ValueError("SIGNED_URL_SECRET must be at least 32 characters long")
        if v in ["dev_change_me", "change_me", "secret"]:
            raise ValueError("SIGNED_URL_SECRET must not use default/placeholder values")
        return v

    @field_validator("POSTGRES_PASSWORD", mode="before")
    @classmethod
    def validate_postgres_password(cls, v: str) -> str:
        """Validate PostgreSQL password strength."""
        if not v or len(v) < 12:
            raise ValueError("POSTGRES_PASSWORD must be at least 12 characters long")
        if v in ["shomer", "password", "admin", "root", "postgres"]:
            raise ValueError("POSTGRES_PASSWORD must not use weak/default values")
        return v

    @field_validator("PUBLIC_BASE_URL", mode="before")
    @classmethod
    def validate_public_base_url(cls, v: str) -> str:
        """Validate PUBLIC_BASE_URL for production security."""
        if not v:
            return v
        
        # In production, enforce HTTPS
        if cls._is_production_environment():
            if not v.startswith("https://"):
                raise ValueError("PUBLIC_BASE_URL must use HTTPS in production")
            if "localhost" in v or "127.0.0.1" in v:
                raise ValueError("PUBLIC_BASE_URL must not use localhost in production")
        
        return v

    @classmethod
    def _is_production_environment(cls) -> bool:
        """Check if running in production environment."""
        import os
        return os.getenv("ENVIRONMENT", "development").lower() == "production"

    @classmethod
    def validate_secrets_strength(cls, values: dict) -> dict:
        """Validate all secrets meet security requirements."""
        # Additional validation for production
        if cls._is_production_environment():
            weak_patterns = [
                r'^(password|123456|admin|root|test|demo)$',
                r'^(changeme|change_me|default|secret)$',
                r'^[a-z]{1,8}$',  # Too short and only lowercase
                r'^\d+$',  # Only numbers
            ]
            
            secrets_to_check = [
                ("API_SECRET_KEY", values.get("API_SECRET_KEY")),
                ("JWT_SECRET", values.get("JWT_SECRET")),
                ("SIGNED_URL_SECRET", values.get("SIGNED_URL_SECRET")),
                ("POSTGRES_PASSWORD", values.get("POSTGRES_PASSWORD")),
            ]
            
            for secret_name, secret_value in secrets_to_check:
                if secret_value:
                    for pattern in weak_patterns:
                        if re.match(pattern, secret_value, re.IGNORECASE):
                            raise ValueError(f"{secret_name} appears to be weak or predictable")
        
        return values

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

