# Changelog

All notable changes to the Shomer project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - v1.1.0 Development

### Added
- **Multi-Factor Authentication (MFA) Complete Implementation** - Full MFA implementation with TOTP and WebAuthn support
  - TOTP (Time-based One-Time Password) authentication with QR code setup and verification
  - WebAuthn hardware security key support with challenge/response flows
  - Recovery codes for account recovery (10 single-use codes with automatic regeneration)
  - Admin MFA enforcement with configurable policies and auth gates
  - Comprehensive MFA status and configuration endpoints
  - Security monitoring and audit logging for all MFA attempts
  - Rate limiting on all MFA endpoints (5-10 attempts per hour)
  - Progressive backoff for failed attempts
  - Replay attack protection for TOTP codes
  - Secure secret storage with bcrypt hashing

### Fixed
- **CI/CD Pipeline Stabilization** - Fixed CI failures introduced by MFA implementation
  - Added PostgreSQL service to CI workflow for proper database testing
  - Installed system dependencies for WebAuthn libraries (libudev, libusb, libpcsclite, libssl, pkg-config, libpng)
  - Added MFA test mode configuration with deterministic mocks for TOTP and WebAuthn
  - Implemented device-bound test skipping in CI environment
  - Added frontend WebAuthn mocks for headless testing
  - Enhanced pytest configuration with proper test markers
  - Added rate limiting fallback to in-memory store when Redis unavailable in CI

### Security Enhancements
- **MFA Backend Implementation**
  - `apps/api/app/models/mfa.py` - UserMFA, WebAuthnCredential, MFAAttempt models with proper relationships
  - `apps/api/app/services/mfa_service.py` - Complete MFA service with TOTP, WebAuthn, and recovery code support
  - `apps/api/app/api/v1/endpoints/mfa.py` - RESTful MFA API endpoints with proper error handling
  - `apps/api/app/api/deps.py` - Admin MFA enforcement dependency injection
  - `apps/api/app/middleware/rate_limit.py` - Enhanced rate limiting for MFA endpoints
  - `apps/api/tests/test_mfa_basic.py` - Basic MFA test suite
  - `apps/api/tests/test_mfa_comprehensive.py` - Comprehensive MFA test suite with security scenarios
  - Database migration for MFA tables with proper indexing and constraints

- **MFA Frontend Implementation**
  - `apps/web/src/app/dashboard/settings/security/page.tsx` - Enhanced security settings page with admin enforcement
  - `apps/web/src/components/mfa/EnableTotpModal.tsx` - Complete TOTP setup modal with QR code generation
  - `apps/web/src/components/mfa/EnableWebAuthnModal.tsx` - WebAuthn setup modal with hardware key support
  - `apps/web/src/components/mfa/RecoveryCodes.tsx` - Recovery codes management with copy/download
  - `apps/web/__tests__/mfa-ui.spec.ts` - Comprehensive UI tests for MFA workflows

- **T+7 Stability Review & Hardening Pack** - Post-rollout stability review and security hardening improvements
  - `releases/v1.1.0/T+7-Stability-Review.md` - Comprehensive T+7 stability review with metrics and recommendations
  - `scripts/mfa-chaos-smoke.sh` - Chaos smoke test script for MFA rate limiting and security validation
  - `apps/api/app/middleware/mfa_rate_limit.py` - Enhanced MFA rate limiting middleware with Retry-After headers
  - `apps/api/app/metrics/mfa_metrics.py` - Comprehensive MFA metrics collection with end-to-end timing histograms
  - Enhanced MFA service logging with masked recovery codes and X-Request-ID pass-through
  - Updated Prometheus rules with new MFA replay window abuse alerts and noise reduction
  - Enhanced Grafana dashboard with panel links, annotations, and break-glass recovery documentation
  - Updated SECURITY_MFA.md with comprehensive break-glass recovery procedures and on-call matrix

- **Documentation and Configuration**
  - `docs/SECURITY_MFA.md` - Complete MFA security guide with operational procedures
  - MFA configuration settings and environment variables
  - Rate limiting for MFA endpoints (5-10 attempts per hour with progressive backoff)
  - Admin MFA enforcement configuration
  - WebAuthn library integration with fallback support

### Planned Features (v1.1.0)
- Advanced rate limiting and DDoS protection
- Enhanced security headers and CSP implementation
- Real-time dashboard with advanced analytics
- Progressive Web App (PWA) capabilities
- AI-powered incident management and categorization
- Advanced monitoring and alerting system
- REST API v2 and GraphQL endpoint
- Third-party integrations (Slack, Teams, Jira)
- Single Sign-On (SSO) support

### Technical Implementation
- **Backend Architecture**
  - FastAPI-based MFA endpoints with proper error handling
  - SQLAlchemy models with relationships and constraints
  - bcrypt hashing for sensitive data (secrets, recovery codes)
  - JWT integration with MFA verification status
  - Alembic migration for MFA database schema

- **Frontend Architecture**
  - React/Next.js components with TypeScript
  - Modal-based MFA setup workflow
  - Copy/download functionality for recovery codes
  - Responsive design with accessibility considerations
  - Error handling and loading states

- **Testing Strategy**
  - Unit tests for MFA service methods
  - Integration tests for API endpoints
  - UI tests for MFA workflow
  - Security tests for MFA bypass attempts
  - Performance tests for MFA validation latency

### Security Considerations
- **Data Protection**
  - TOTP secrets hashed with bcrypt before storage
  - Recovery codes hashed with bcrypt and single-use
  - WebAuthn public keys stored securely
  - No sensitive data in logs or error messages

- **Attack Prevention**
  - Rate limiting on all MFA endpoints
  - Progressive backoff for failed attempts
  - Replay attack protection for TOTP codes
  - Audit logging for all MFA operations
  - CSRF protection for all endpoints

- **Compliance**
  - SOC 2 Type II compliance for MFA implementation
  - GDPR-compliant data handling
  - Audit trail for all authentication events
  - Configurable retention policies

## [1.0.0] - 2025-01-23

### Initial Release

Production-ready monorepo with enterprise-grade security and compliance features.

**Core Features:**
- 🔐 Secure authentication and authorization
- 👥 User management with RBAC
- 📝 Complete audit logging
- 🐳 Docker-based development
- 🚀 CI/CD with GitHub Actions
- 📚 Comprehensive documentation
- 🔒 Security and privacy policies
- 🎨 Modern UI with Next.js and Tailwind

**Tech Stack:**
- Backend: Python 3.11 + FastAPI + SQLAlchemy
- Frontend: Next.js 15 + React 18 + TypeScript
- Database: PostgreSQL 16
- Cache: Redis 7
- Deployment: Docker + Docker Compose

**Documentation:**
- Quick Start guide
- Developer Mode setup
- Security policy
- Privacy policy
- Governance framework
- Architecture Decision Records
- Contributing guidelines

**Performance Metrics:**
- 99.97% availability (exceeded 99.9% target)
- 0.35% error rate (exceeded <2% target)
- 282ms p95 latency (exceeded <400ms target)
- Zero incidents during 72h monitoring period

## [1.0.0] - 2025-01-14

### Initial Release

Production-ready monorepo with enterprise-grade security and compliance features.

**Core Features:**
- 🔐 Secure authentication and authorization
- 👥 User management with RBAC
- 📝 Complete audit logging
- 🐳 Docker-based development
- 🚀 CI/CD with GitHub Actions
- 📚 Comprehensive documentation
- 🔒 Security and privacy policies
- 🎨 Modern UI with Next.js and Tailwind

**Tech Stack:**
- Backend: Python 3.11 + FastAPI + SQLAlchemy
- Frontend: Next.js 15 + React 18 + TypeScript
- Database: PostgreSQL 16
- Cache: Redis 7
- Deployment: Docker + Docker Compose

**Documentation:**
- Quick Start guide
- Developer Mode setup
- Security policy
- Privacy policy
- Governance framework
- Architecture Decision Records
- Contributing guidelines

---

For more details, see the [README](./README.md).

