# Shomer

> Production-ready monorepo for content triage with enterprise-grade security, RBAC, and comprehensive auditing.

[![CI](https://github.com/your-org/shomer/workflows/CI/badge.svg)](https://github.com/your-org/shomer/actions)
[![Security](https://github.com/your-org/shomer/workflows/Security/badge.svg)](https://github.com/your-org/shomer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Shomer is a production-ready monorepo featuring:

- **FastAPI Backend**: Modern Python API with type safety and automatic documentation
- **Next.js Frontend**: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **RBAC Security**: Role-based access control (Viewer, Moderator, Admin)
- **Audit Logging**: Complete audit trail for all system actions
- **Docker Ready**: Full Docker Compose setup for local development
- **CI/CD**: GitHub Actions for testing, linting, and deployment
- **Compliance**: GDPR-ready with comprehensive security and privacy policies

## Table of Contents

- [Quick Start](#quick-start)
- [Developer Mode](#developer-mode)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

Get Shomer running in under 5 minutes with Docker.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/shomer.git
cd shomer
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

For local development, the defaults work fine. For production, update secrets and credentials.

### 3. Start All Services

```bash
cd infra
docker compose up --build
```

This will start:
- **PostgreSQL** (database) on `localhost:5432`
- **Redis** (cache/queue) on `localhost:6379`
- **MinIO** (S3-compatible storage) on `localhost:9000` / `localhost:9001` (console)
- **API** (FastAPI backend) on `http://localhost:8000`
- **Web** (Next.js frontend) on `http://localhost:3000`
- **Worker** (ingestion/background jobs)

First boot will automatically:
✅ Run database migrations  
✅ Seed admin user  
✅ Create MinIO bucket  

### 4. Access the Application

- **Web Interface**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **API Health Check**: http://localhost:8000/health
- **MinIO Console**: http://localhost:9001

### 5. Login

Default credentials automatically created:

**Login**: `admin@shomer.local` / `admin123`

Additional test accounts:
- **Moderator**: `moderator@shomer.local` / `mod123`
- **User**: `user@shomer.local` / `user123`

⚠️ **Change these credentials immediately in production!**

## Developer Mode

For active development without Docker.

### Prerequisites

- **Python**: 3.11+ ([download](https://www.python.org/downloads/))
- **Node.js**: 20+ ([download](https://nodejs.org/))
- **pnpm**: 8+ (`npm install -g pnpm`)
- **uv**: Latest ([install](https://github.com/astral-sh/uv))
- **PostgreSQL**: 16+ (local or Docker)
- **Redis**: 7+ (local or Docker)

### Initial Setup

```bash
# 1. Install dependencies
make setup

# This installs:
# - pnpm dependencies for web & shared packages
# - Python dependencies via uv for API
# - pre-commit hooks
```

### Start Development Servers

#### Option 1: Use Makefile (Recommended)

```bash
# Start all services in Docker (DB + Redis + API + Web)
make dev
```

#### Option 2: Manual Start (More Control)

```bash
# Terminal 1: Start PostgreSQL and Redis
docker compose up db redis

# Terminal 2: Start API
cd apps/api
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3: Start Web
cd apps/web
pnpm dev

# Terminal 4: Watch shared package (optional)
cd packages/shared
pnpm dev
```

### Development URLs

- **Web**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **OpenAPI JSON**: http://localhost:8000/api/v1/openapi.json

### Database Migrations

```bash
cd apps/api

# Create a new migration
uv run alembic revision --autogenerate -m "Description"

# Apply migrations
uv run alembic upgrade head

# Rollback last migration
uv run alembic downgrade -1
```

### Common Development Tasks

```bash
# Run all tests
make test

# Format all code
make format

# Lint all code
make lint

# Type check
make typecheck

# Clean build artifacts
make clean

# View all available commands
make help
```

## Architecture

Shomer follows a modern monorepo architecture with clear separation of concerns.

```
┌─────────────────────────────────────────────────────┐
│                   Web Frontend                      │
│              (Next.js + React + TS)                 │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────┐
│                  API Backend                        │
│               (FastAPI + Python)                    │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
           ▼                      ▼
    ┌──────────┐          ┌──────────┐
    │PostgreSQL│          │  Redis   │
    │(Database)│          │ (Cache)  │
    └──────────┘          └──────────┘
```

### Key Design Decisions

See [Architecture Decision Records (ADRs)](./docs/adr/) for detailed rationale:

- [ADR-001: Monorepo Structure](./docs/adr/001-monorepo-structure.md)
- [ADR-002: FastAPI Backend](./docs/adr/002-fastapi-backend.md)
- [ADR-003: Next.js Frontend](./docs/adr/003-nextjs-frontend.md)
- [ADR-004: PostgreSQL Database](./docs/adr/004-postgresql-database.md)
- [ADR-005: RBAC Model](./docs/adr/005-rbac-model.md)

## Project Structure

```
shomer/
├── apps/
│   ├── api/                      # FastAPI backend service
│   │   ├── app/
│   │   │   ├── api/             # API routes
│   │   │   ├── core/            # Config, security
│   │   │   ├── db/              # Database setup
│   │   │   ├── models/          # SQLAlchemy models
│   │   │   ├── schemas/         # Pydantic schemas
│   │   │   └── main.py          # Application entry
│   │   ├── alembic/             # Database migrations
│   │   ├── tests/               # API tests
│   │   ├── Dockerfile           # API container
│   │   └── pyproject.toml       # Python dependencies
│   │
│   └── web/                      # Next.js frontend
│       ├── src/
│       │   ├── app/             # Next.js app router
│       │   ├── components/      # React components
│       │   └── lib/             # Utilities
│       ├── public/              # Static assets
│       ├── Dockerfile           # Web container
│       └── package.json         # Node dependencies
│
├── packages/
│   └── shared/                   # Shared TypeScript code
│       ├── src/
│       │   ├── types.ts         # Shared types
│       │   └── client.ts        # API client
│       └── scripts/
│           └── generate-client.js # OpenAPI client generator
│
├── infra/                        # Infrastructure code
│   ├── docker/                  # Docker configs
│   └── terraform/               # Terraform (skeleton)
│
├── docs/                         # Documentation
│   ├── adr/                     # Architecture decisions
│   ├── SECURITY.md              # Security policy
│   ├── PRIVACY.md               # Privacy policy
│   └── GOVERNANCE.md            # Governance framework
│
├── .github/
│   ├── workflows/               # CI/CD pipelines
│   └── ISSUE_TEMPLATE/          # Issue templates
│
├── docker-compose.yml           # Local development stack
├── Makefile                     # Common commands
├── pnpm-workspace.yaml          # Workspace config
└── README.md                    # This file
```

## Configuration

### Environment Variables

#### On-Call Rota API

The On-Call Rota API requires write authentication for POST, PUT, and DELETE operations:

```bash
# Required for write operations
ACTION_SECRET=your-16-plus-character-secret-key

# Optional: Redis configuration (disabled by default)
USE_REDIS=false
# REDIS_URL=redis://localhost:6379
```

**Write Operations Require X-Action-Secret Header:**
- `POST /api/oncall/rota` - Create new shift
- `PUT /api/oncall/rota/:id` - Update existing shift  
- `DELETE /api/oncall/rota/:id` - Delete shift

**Read Operations (No Auth Required):**
- `GET /api/oncall/rota` - List shifts
- `GET /api/oncall/status` - Current on-call status
- `GET /api/oncall/audit` - View audit trail
- `GET /api/orgs` - List organizations for demo week seeding

**Demo Week Seeding:**
- `POST /api/oncall/rota/seed-week?orgId=<id>&start=YYYY-MM-DD` - Create 7 days of demo shifts

**Add Demo Week:**
1. Open `/oncall/rota` in your browser
2. Click the "Add Demo Week" button
3. Choose an organization from the dropdown
4. Select a start date (defaults to next Monday)
5. Set the `X-Action-Secret` header (same as server `ACTION_SECRET`)
6. Submit to create 7 days of 8-hour shifts (09:00-17:00 UTC) rotating between available users

**Note:** All times are stored in UTC; display converts to local timezone.

**CSV Export:**
- `GET /api/oncall/rota.csv?orgId=&from=&to=` - Export rota shifts as CSV
- `GET /api/oncall/audit.csv?orgId=&from=&to=` - Export audit logs as CSV

Times in UTC. Use date-only YYYY-MM-DD or ISO format. From the UI: `/oncall/rota` → Export CSV.

**Calendar Export (.ics):**
- `GET /api/oncall/rota.ics?orgId=&from=&to=&tz=America/Los_Angeles` - Export rota shifts as iCalendar

Times are stored in UTC; ICS uses UTC DTSTART/DTEND (Z). `tz` is a display hint in calendar metadata. From the UI: `/oncall/rota` → **Add to Calendar (.ics)**.

**Read-Only Share Links:**
- Each organization has a `shareToken` for read-only exports.
- CSV: `/api/oncall/rota.csv?token=<shareToken>&from=&to=`
- ICS: `/api/oncall/rota.ics?token=<shareToken>&from=&to=&tz=America/Los_Angeles`
- Rotate token (revokes old links): `POST /api/orgs/:orgId/rotate-share-token` (requires X-Action-Secret)
- UI: On `/oncall/rota`, use "Share links" to copy URLs or rotate token.

**Example API Usage:**
```bash
# Create shift (requires X-Action-Secret header)
curl -X POST http://localhost:3000/api/oncall/rota \
  -H "Content-Type: application/json" \
  -H "X-Action-Secret: your-secret-key" \
  -d '{"userId":"user-1","startsAt":"2025-01-20T09:00:00Z","endsAt":"2025-01-20T17:00:00Z"}'

# List shifts (no auth required)
curl http://localhost:3000/api/oncall/rota
```

### Per-Org API Keys

Authorize org-scoped writes with a scoped key instead of the global secret.

**Headers:**
- Global (legacy):  `X-Action-Secret: <ACTION_SECRET>`
- Org-scoped:       `X-Org-Api-Key: <plain key value>`

**Manage:**
- List:   `GET  /api/orgs/:orgId/api-keys`
- Create: `POST /api/orgs/:orgId/api-keys`   (requires org write auth)
- Revoke: `DELETE /api/orgs/:orgId/api-keys/:id`   (requires org write auth)

**Notes:**
- Keys are stored hashed (sha256) and shown **only once** on creation.
- Include a `label` and optional `expiresAt` when creating keys.
- Most write routes now accept either header; org keys are **scoped to the org**.

### Org API Key Scopes & Rate Limits

Per-org API keys can be limited by scope and rate.

**Scopes:**
- `rota.write` — create/update/delete shifts
- `copy.week` — clone week forward
- `seed.week` — seed demo week
- `settings.write` — update org settings
- `share.rotate` — rotate share token
- `webhook.manage` — manage webhook endpoints
- `swap.approve` — approve swaps
- `swap.decline` — decline swaps

**Create:**
```bash
POST /api/orgs/:orgId/api-keys
Content-Type: application/json
X-Action-Secret: <ACTION_SECRET>

{
  "label": "CI",
  "scopes": ["copy.week","rota.write"],
  "requestsPerMinute": 60
}
```

**Use:**
- Global:  `X-Action-Secret: <ACTION_SECRET>`   (bypasses scopes/rate)
- Scoped:  `X-Org-Api-Key: <plain key value>`   (must include required scope; rate-limited if set)

**Errors:**
- `401 unauthorized` (missing/invalid key)
- `403 forbidden_scope` (scope not granted)
- `429 rate_limited` (per-key rpm exceeded)

### Environment Variables

All configuration is done via environment variables. Copy `.env.example` to `.env` and customize:

#### Database

```bash
POSTGRES_USER=shomer
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=shomer
DATABASE_URL=postgresql+psycopg://shomer:shomer@db:5432/shomer
```

#### Redis

```bash
REDIS_URL=redis://redis:6379/0
```

#### API

```bash
API_HOST=0.0.0.0
API_PORT=8000
API_SECRET_KEY=<generate-strong-secret>
```

#### Authentication

```bash
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRES_IN=3600  # 1 hour
```

#### Notifications (Optional)

```bash
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_FROM_NUMBER=<your-number>
SENDGRID_API_KEY=<your-key>
```

#### Frontend

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Generating Secrets

```bash
# Generate a secure random secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Or use openssl
openssl rand -base64 32
```

## Testing

### Run All Tests

```bash
make test
```

### Run Specific Tests

#### API Tests

```bash
cd apps/api
uv run pytest

# With coverage
uv run pytest --cov --cov-report=html

# Specific test file
uv run pytest tests/test_main.py

# Specific test
uv run pytest tests/test_main.py::test_health_check
```

#### Web Tests

```bash
cd apps/web
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run integration tests
make test-integration

# Cleanup
docker compose -f docker-compose.test.yml down
```

## Deployment

### Docker Deployment

Shomer uses GitHub Actions to automatically build and push multi-arch Docker images to GitHub Container Registry (GHCR).

#### Automated Builds

Docker images are automatically built and pushed on every version tag:

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

This triggers the Docker workflow which:
- Builds multi-arch images (amd64, arm64)
- Pushes to GitHub Container Registry
- Creates a GitHub Release with release notes

#### Pull Images

```bash
# Pull from GHCR
docker pull ghcr.io/your-org/shomer/api:latest
docker pull ghcr.io/your-org/shomer/web:latest

# Or specific version
docker pull ghcr.io/your-org/shomer/api:v1.0.0
docker pull ghcr.io/your-org/shomer/web:v1.0.0
```

#### Required Secrets

No additional secrets required! The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions.

**Optional secrets** for enhanced functionality:

| Secret | Purpose | Required |
|--------|---------|----------|
| `CODECOV_TOKEN` | Upload test coverage to Codecov | No |

To add secrets:
1. Go to your repository Settings
2. Navigate to Secrets and variables → Actions
3. Click "New repository secret"
4. Add the secret name and value

#### Manual Build

For local testing:

```bash
# Build API image
docker build -t shomer-api:latest ./apps/api

# Build Web image
docker build -t shomer-web:latest ./apps/web
```

### Cloud Deployment

See [Infrastructure Documentation](./infra/) for:

- **Terraform**: Infrastructure as code (skeleton provided)
- **Kubernetes**: Helm charts (coming soon)
- **Cloud Providers**: AWS, GCP, Azure guides (coming soon)

### Production Checklist

- [ ] Change all default passwords and secrets
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Configure log aggregation
- [ ] Set up monitoring and alerting
- [ ] Enable rate limiting
- [ ] Review CORS settings
- [ ] Set up CDN for static assets
- [ ] Configure email service
- [ ] Test disaster recovery plan
- [ ] Review security policy
- [ ] Set up error tracking (Sentry, etc.)

## Security

### Reporting Security Issues

**DO NOT** open a public issue for security vulnerabilities.

Instead, email: **security@shomer.local**

We will respond within 24 hours.

### Security Features

- ✅ **Role-Based Access Control**: Viewer, Moderator, Admin roles
- ✅ **JWT Authentication**: Secure token-based auth
- ✅ **Password Hashing**: Bcrypt with cost factor 12
- ✅ **Audit Logging**: Complete trail of all actions
- ✅ **Input Validation**: Pydantic schemas
- ✅ **SQL Injection Protection**: SQLAlchemy ORM
- ✅ **XSS Protection**: React auto-escaping
- ✅ **CSRF Protection**: Built into Next.js
- ✅ **Rate Limiting**: Redis-based (coming soon)
- ✅ **Secrets Management**: Environment variables, no hardcoded secrets

### Security Documentation

- [Security Policy](./docs/SECURITY.md) - Comprehensive security practices
- [Privacy Policy](./docs/PRIVACY.md) - Data protection and privacy
- [Governance](./docs/GOVERNANCE.md) - Human-in-the-loop oversight

### RBAC Roles

| Role      | Permissions                                           |
|-----------|-------------------------------------------------------|
| Viewer    | View own profile                                      |
| Moderator | View users, view audit logs, manage users             |
| Admin     | Full access, modify settings, change roles            |

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`make test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Standards

- **Python**: black, isort, ruff, mypy
- **TypeScript**: ESLint, Prettier
- **Commits**: Conventional Commits format
- **Documentation**: Update README and ADRs as needed

### Pre-commit Hooks

Pre-commit hooks are automatically installed with `make setup`. They run:

- Code formatting (black, prettier)
- Linting (ruff, eslint)
- Type checking (mypy)
- Secret scanning

To run manually:

```bash
pre-commit run --all-files
```

## FAQ

### How do I reset the database?

```bash
docker compose down -v  # Remove volumes
docker compose up -d    # Restart with fresh DB
```

### How do I add a new API endpoint?

1. Add route in `apps/api/app/api/v1/endpoints/`
2. Add schema in `apps/api/app/schemas/`
3. Add model if needed in `apps/api/app/models/`
4. Create migration: `alembic revision --autogenerate -m "Add model"`
5. Apply migration: `alembic upgrade head`
6. Update shared types in `packages/shared/src/types.ts`

### How do I add a new page to the web app?

1. Create route in `apps/web/src/app/[route]/page.tsx`
2. Add components in `apps/web/src/components/`
3. Use shared API client from `@shomer/shared`

### How do I generate TypeScript client from API?

```bash
# Make sure API is running
docker compose up api

# Generate client
cd packages/shared
pnpm generate
```

## Public Read-Only Status

Shomer provides public, read-only access to on-call rota information via organization share tokens.

### Features

- **Public Status Page**: Read-only view of current on-call and upcoming shifts
- **Auto-refresh**: Updates every 60 seconds automatically
- **Export Links**: Direct access to ICS calendar and CSV exports
- **Embeddable Widget**: Compact widget for external websites
- **Token Security**: Organization-specific tokens with rotation support

### Usage

#### Public Status Page

Access the public status page with a valid organization share token:

```
/public/rota?token=<shareToken>&from=2024-01-01&to=2024-01-07
```

**Parameters:**
- `token` (required): Organization share token
- `from` (optional): Start date (ISO format)
- `to` (optional): End date (ISO format)

**Features:**
- Shows current on-call person with "ON-CALL NOW" badge
- Displays next 7 days of scheduled shifts
- Auto-refreshes every 60 seconds
- Export buttons for ICS calendar and CSV files
- Copy-to-clipboard functionality for export links

#### Public API

Programmatic access to rota data:

```
GET /api/public/oncall/summary?token=<shareToken>&from=2024-01-01&to=2024-01-07
```

**Response:**
```json
{
  "ok": true,
  "org": {
    "id": "org-123",
    "name": "Example Organization"
  },
  "window": {
    "from": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-07T00:00:00.000Z"
  },
  "now": {
    "id": "shift-123",
    "user": {
      "id": "user-456",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "startsAt": "2024-01-01T00:00:00.000Z",
    "endsAt": "2024-01-01T12:00:00.000Z",
    "region": "US"
  },
  "upcoming": [
    {
      "id": "shift-124",
      "user": {
        "id": "user-789",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "startsAt": "2024-01-01T12:00:00.000Z",
      "endsAt": "2024-01-02T00:00:00.000Z",
      "region": "EU"
    }
  ]
}
```

#### Embeddable Widget

Add a compact on-call widget to any website:

```html
<div id="shomer-rota" data-token="<shareToken>"></div>
<script src="<APP_URL>/public/rota/widget.js" async></script>
```

**Features:**
- Shows current on-call person and next 3 upcoming shifts
- Auto-refreshes every 5 minutes
- Responsive design with inline CSS
- Fails gracefully with "Unavailable" message
- No external dependencies

#### Public JSON + Badge

**JSON "now" endpoint:**
```
GET /api/public/oncall/now?token=<shareToken>
```

**Response:**
```json
{
  "ok": true,
  "org": {
    "id": "org-123",
    "name": "Example Organization"
  },
  "now": {
    "id": "shift-123",
    "user": {
      "id": "user-456",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "startsAt": "2024-01-01T00:00:00.000Z",
    "endsAt": "2024-01-01T12:00:00.000Z",
    "region": "US"
  },
  "ts": "2024-01-01T12:00:00.000Z"
}
```

**SVG Badge:**
```
GET /api/public/oncall/badge.svg?token=<shareToken>&theme=light|dark
```

**Features:**
- Shows "ON-CALL: <User Name>" when active; "ON-CALL: —" when idle
- Light and dark theme support
- Clean, legible design with system fonts
- Auto-width based on text length
- Shield.io style design

**HTML Embed Example:**
```html
<img alt="On-Call" src="<APP_URL>/api/public/oncall/badge.svg?token=<shareToken>&theme=light" />
```

**Caching:** All endpoints include aggressive caching headers: `Cache-Control: public, max-age=30, s-maxage=60, stale-while-revalidate=300`

### Security

- **Token-based Access**: Each organization has a unique share token
- **Read-only**: Public endpoints only allow viewing data, no modifications
- **Token Rotation**: Admins can rotate tokens to revoke previously shared links
- **No Authentication**: Public access doesn't require user login
- **Rate Limiting**: API endpoints include rate limiting protection

### Timezone Handling

- All times stored in UTC in the database
- Public pages display times in the viewer's local timezone
- Export files can include timezone information
- API returns UTC ISO timestamps

### Notes

- Token grants read-only visibility for that org's on-call window
- Rotate the org's token to revoke previously shared links
- All times stored in UTC; page displays in viewer's local timezone
- Widget supports multiple instances on the same page
- Public access is rate-limited to prevent abuse

## Copy Week → Next Week

Clone a 7-day rota window forward by N weeks (overlap-safe).

### API

**Endpoint:**
```
POST /api/oncall/rota/copy-week?orgId=<id>&from=YYYY-MM-DD&weeks=1
```

**Headers:**
```
X-Action-Secret: <your secret>
```

**Response:**
```json
{
  "ok": true,
  "created": 3,
  "skipped": 0,
  "targetFrom": "2025-01-27T00:00:00.000Z",
  "targetTo": "2025-02-02T23:59:59.999Z"
}
```

### Usage (curl)

```bash
curl -sS -X POST \
  -H "X-Action-Secret: $ACTION_SECRET" \
  "http://localhost:3000/api/oncall/rota/copy-week?orgId=ORG_1&from=2025-01-20&weeks=1"
```

### Features

- **Overlap-safe**: Automatically skips shifts that would conflict with existing assignments
- **Audit trail**: Creates audit log entries for all copied shifts
- **Flexible timing**: Copy 1-12 weeks forward
- **UTC handling**: Preserves local times using UTC math on timestamps
- **Idempotent**: Running multiple times won't create duplicates

### Parameters

- `orgId` (required): Organization ID
- `from` (required): Start date in YYYY-MM-DD format (UTC midnight window start)
- `weeks` (optional): Number of weeks to copy forward (1-12, default: 1)

---

## Shift Swaps

Request to reassign a shift to another user, with admin approval.

### API

**Create Swap Request:**
```
POST /api/oncall/swaps
```

**Body:**
```json
{
  "orgId": "org_123",
  "shiftId": "shift_456", 
  "requestedUserId": "user_789",
  "reason": "Need to attend a conference"
}
```

**Response:**
```json
{
  "ok": true,
  "swap": {
    "id": "swap_abc",
    "status": "PENDING",
    "createdAt": "2024-01-15T10:30:00Z",
    "reason": "Need to attend a conference"
  }
}
```

**List Swap Requests:**
```
GET /api/oncall/swaps?orgId=<id>&status=PENDING|APPROVED|DECLINED
```

**Response:**
```json
{
  "ok": true,
  "swaps": [
    {
      "id": "swap_abc",
      "status": "PENDING",
      "reason": "Need to attend a conference",
      "createdAt": "2024-01-15T10:30:00Z",
      "shift": {
        "startsAt": "2024-01-20T09:00:00Z",
        "endsAt": "2024-01-20T17:00:00Z",
        "user": { "name": "John Doe", "email": "john@example.com" }
      },
      "user": { "name": "Jane Smith", "email": "jane@example.com" }
    }
  ]
}
```

**Approve Swap (requires X-Action-Secret):**
```
POST /api/oncall/swaps/:id/approve
```

**Headers:**
```
X-Action-Secret: <your secret>
```

**Response (success):**
```json
{
  "ok": true,
  "shift": {
    "id": "shift_456",
    "userId": "user_789",
    "startsAt": "2024-01-20T09:00:00Z",
    "endsAt": "2024-01-20T17:00:00Z"
  }
}
```

**Response (overlap conflict):**
```json
{
  "ok": false,
  "error": "overlap",
  "code": "TARGET_CONFLICT"
}
```

**Decline Swap (requires X-Action-Secret):**
```
POST /api/oncall/swaps/:id/decline
```

**Headers:**
```
X-Action-Secret: <your secret>
```

**Response:**
```json
{
  "ok": true,
  "swap": {
    "id": "swap_abc",
    "status": "DECLINED",
    "decidedAt": "2024-01-15T11:00:00Z",
    "decidedBy": "system"
  }
}
```

### Usage Examples (curl)

**Create a swap request:**
```bash
curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org_123",
    "shiftId": "shift_456",
    "requestedUserId": "user_789", 
    "reason": "Need to attend a conference"
  }' \
  "http://localhost:3000/api/oncall/swaps"
```

**List pending swap requests:**
```bash
curl -sS "http://localhost:3000/api/oncall/swaps?orgId=org_123&status=PENDING"
```

**Approve a swap request:**
```bash
curl -sS -X POST \
  -H "X-Action-Secret: $ACTION_SECRET" \
  "http://localhost:3000/api/oncall/swaps/swap_abc/approve"
```

**Decline a swap request:**
```bash
curl -sS -X POST \
  -H "X-Action-Secret: $ACTION_SECRET" \
  "http://localhost:3000/api/oncall/swaps/swap_abc/decline"
```

### Business Rules

- **Overlap Check**: Approval only succeeds if the target user has no overlapping OnCall shifts in the same time window
- **Audit Trail**: On approval, the shift is reassigned and an OnCallAudit row is written with before/after snapshots
- **Authentication**: Approve/decline operations require the `X-Action-Secret` header
- **Status Management**: Swap requests start as `PENDING`, then become `APPROVED` or `DECLINED`

### Webhooks & Activity (Shift Swaps)

Shomer can call your endpoint on swap events.

**Endpoints (per org):**
- List:   `GET  /api/orgs/:orgId/webhooks`
- Create: `POST /api/orgs/:orgId/webhooks`   (requires X-Action-Secret)  Body: `{"url":"https://...","secret":"<min 16 chars>"}`
- Delete: `DELETE /api/orgs/:orgId/webhooks?id=<endpointId>`  (requires X-Action-Secret)

**Delivery:**
- Runner: `POST /api/notifications/deliver`  (safe to call from cron)
- Headers: `Shomer-Signature: sha256=<hex>`, `Shomer-Event: SWAP_CREATED|SWAP_APPROVED|SWAP_DECLINED`
- Body: JSON payload with swap/shift/user info.

**Verify signature (Node.js):**
```javascript
const crypto = require("crypto");
const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
```

**Recommended cron:**
```
* * * * *  curl -fsS -X POST http://localhost:3000/api/notifications/deliver >/dev/null
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons by [Lucide](https://lucide.dev/)

## Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/your-org/shomer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/shomer/discussions)
- **Email**: support@shomer.local

---

**Built with ❤️ by the Shomer team**

