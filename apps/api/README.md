# Shomer API

Production-ready FastAPI application with RBAC, audit logging, and comprehensive incident management.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control (viewer, moderator, admin)
- **User Management**: Full CRUD operations with secure password hashing
- **Incident Management**: CRUD with advanced filtering (severity, status, time range, keyword search) and pagination
- **Tips System**: Community tip submission with image upload support (S3-compatible, local disk for dev)
- **Alerts System**: Templated SMS/Email alerts for moderators (Twilio/SendGrid integration ready)
- **Event Risk Scoring**: AI-ready event risk assessment with placeholder heuristics
- **Audit Logging**: Automatic audit trail for all state-changing operations
- **Data Retention**: Scheduled job to purge expired incidents and tips
- **OpenAPI Documentation**: Auto-generated interactive API docs

## Tech Stack

- **FastAPI**: Modern, fast web framework
- **SQLAlchemy 2.0**: ORM with async support
- **Alembic**: Database migrations
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Pydantic**: Data validation
- **JWT**: Secure token-based authentication
- **APScheduler**: Background task scheduling

## Quick Start

### 1. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration values. For local development, the defaults should work.

### 2. Install Dependencies

Using pip:

```bash
cd apps/api
pip install -e .
```

Or using your preferred package manager.

### 3. Database Setup

Make sure PostgreSQL is running, then run migrations:

```bash
# From the apps/api directory
cd apps/api
alembic upgrade head
```

### 4. Seed Database

Populate the database with initial data (admin user and sample incidents):

```bash
python seed.py
```

This creates:
- **Admin user**: `admin@shomer.local` / `admin123`
- **Moderator user**: `moderator@shomer.local` / `mod123`
- **Viewer user**: `viewer@shomer.local` / `view123`
- Sample incidents for testing

### 5. Start the API

```bash
python run.py
```

The API will start on `http://localhost:8000` (or the host/port specified in your `.env`).

### 6. Access API Documentation

Open your browser to:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/api/v1/openapi.json

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get access token

### Users

- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/users/` - List all users (admin only)
- `GET /api/v1/users/{id}` - Get user by ID (admin only)

### Incidents

- `GET /api/v1/incidents/` - List incidents with filters and pagination
  - Query params: `page`, `page_size`, `severity`, `status`, `start_date`, `end_date`, `keyword`
- `GET /api/v1/incidents/{id}` - Get incident by ID
- `POST /api/v1/incidents/` - Create incident (moderator+)
- `PUT /api/v1/incidents/{id}` - Update incident (moderator+)
- `DELETE /api/v1/incidents/{id}` - Delete incident (admin only)

### Tips

- `POST /api/v1/tips/` - Submit tip with optional image (public)
- `GET /api/v1/tips/` - List tips (moderator+)
- `GET /api/v1/tips/{id}` - Get tip by ID (moderator+)
- `DELETE /api/v1/tips/{id}` - Delete tip (moderator+)

### Alerts

- `POST /api/v1/alerts/` - Create and send alert (moderator+)
- `GET /api/v1/alerts/` - List alerts
- `GET /api/v1/alerts/{id}` - Get alert by ID

### Events

- `POST /api/v1/events/score` - Calculate risk score for an event
- `POST /api/v1/events/` - Create event with automatic scoring
- `GET /api/v1/events/` - List events (with optional min risk score filter)
- `GET /api/v1/events/{id}` - Get event by ID

### Audit Logs

- `GET /api/v1/audit/` - List all audit logs (admin only)
- `GET /api/v1/audit/user/{id}` - Get audit logs for specific user (admin only)

## Role-Based Access Control (RBAC)

The API implements three user roles with hierarchical permissions:

1. **Viewer** (lowest privilege)
   - View incidents, events, and alerts
   - Cannot create, modify, or delete data

2. **Moderator** (mid-level privilege)
   - All viewer permissions
   - Create and update incidents
   - View and manage tips
   - Create and send alerts
   - Create and score events

3. **Admin** (highest privilege)
   - All moderator permissions
   - Delete incidents
   - Manage users
   - View audit logs

## Data Retention

The API includes an automated data retention system:

- Incidents and tips can have an `expires_at` timestamp
- A scheduled job runs daily at 2 AM to purge expired records
- The purge job also runs on application startup

## Development

### Running Tests

```bash
# From apps/api directory
pytest

# With coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py
```

### Database Migrations

Create a new migration:

```bash
alembic revision --autogenerate -m "Description of changes"
```

Apply migrations:

```bash
alembic upgrade head
```

Rollback migration:

```bash
alembic downgrade -1
```

### Code Quality

The project includes configuration for:

- **Black**: Code formatting
- **isort**: Import sorting
- **Ruff**: Fast linting
- **MyPy**: Type checking

Run checks:

```bash
black .
isort .
ruff check .
mypy app
```

## TypeScript Client

A TypeScript client is available in `/packages/shared` for frontend integration.

To generate the client from the OpenAPI schema:

```bash
cd packages/shared
npm run generate
```

This requires the API to be running locally.

## Production Deployment

For production deployment:

1. Set strong secrets in `.env`:
   - Change `API_SECRET_KEY`
   - Change `JWT_SECRET`
   - Use strong database passwords

2. Configure external services:
   - Set up Twilio for SMS alerts
   - Set up SendGrid for email alerts
   - Configure S3 or compatible storage for file uploads

3. Use production-ready database:
   - PostgreSQL with proper backups
   - Redis for session management

4. Enable HTTPS and configure CORS appropriately

5. Set up monitoring and logging

6. Use process manager (e.g., systemd, supervisor) or container orchestration

## Environment Variables

See `.env.example` for all available configuration options.

## License

See LICENSE file in repository root.

