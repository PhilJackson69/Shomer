# Changelog

All notable changes to the Shomer project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo structure
- FastAPI backend service with RBAC
- Next.js 15 frontend with Tailwind CSS and shadcn/ui
- Shared TypeScript package with OpenAPI client
- Docker Compose development environment
- PostgreSQL database with Alembic migrations
- Redis caching layer
- JWT-based authentication
- Audit logging system
- Pre-commit hooks for code quality
- GitHub Actions CI/CD pipeline
- Comprehensive documentation (Security, Privacy, Governance)
- Architecture Decision Records (ADRs)
- Terraform infrastructure skeleton
- Security scanning and secret detection
- RBAC with three roles: Viewer, Moderator, Admin

### Security
- Bcrypt password hashing
- JWT token authentication
- Role-based access control
- Complete audit trail
- Secret detection in pre-commit hooks
- Trivy vulnerability scanning
- CodeQL analysis

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

