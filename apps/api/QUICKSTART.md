# Shomer API - Quick Start Guide

Get the API running in 5 minutes!

## Prerequisites

- Python 3.11+
- PostgreSQL
- Redis (optional, but recommended)

## Step-by-Step Setup

### 1. Navigate to API directory
```bash
cd apps/api
```

### 2. Create environment file
```bash
cp env.example .env
```

For local development, the defaults in `env.example` work with the docker-compose setup.

### 3. Install dependencies
```bash
pip install -e .
```

### 4. Start database (if using Docker)
```bash
# From repository root
docker-compose up -d db redis
```

Or configure your local PostgreSQL/Redis in `.env`

### 5. Run database migrations
```bash
alembic upgrade head
```

### 6. Seed the database
```bash
python seed.py
```

This creates:
- Admin user: `admin@shomer.local` / `admin123`
- Moderator user: `moderator@shomer.local` / `mod123`
- Viewer user: `viewer@shomer.local` / `view123`
- Sample incidents and subscribers

### 7. Start the API server
```bash
python run.py
```

The API will start on http://localhost:8000

### 8. Access the documentation
Open your browser to:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Test the API

### Using Swagger UI (Easiest)

1. Go to http://localhost:8000/docs
2. Click on `POST /api/v1/auth/login`
3. Click "Try it out"
4. Enter credentials:
   ```json
   {
     "username": "admin",
     "password": "admin123"
   }
   ```
5. Click "Execute"
6. Copy the `access_token` from the response
7. Click the "Authorize" button at the top
8. Enter: `Bearer YOUR_TOKEN_HERE`
9. Now you can test any endpoint!

### Using cURL

#### 1. Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Response:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

#### 2. List Incidents
```bash
TOKEN="your_access_token_here"

curl -X GET "http://localhost:8000/api/v1/incidents/?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Create Incident (as moderator/admin)
```bash
curl -X POST http://localhost:8000/api/v1/incidents/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Incident",
    "description": "This is a test incident",
    "severity": "medium",
    "status": "open",
    "location": "Test Location"
  }'
```

#### 4. Submit a Tip (public, no auth needed)
```bash
curl -X POST http://localhost:8000/api/v1/tips/ \
  -F "content=Suspicious activity near downtown" \
  -F "submitter_email=reporter@example.com" \
  -F "location=Downtown Square"
```

#### 5. Submit Tip with Image
```bash
curl -X POST http://localhost:8000/api/v1/tips/ \
  -F "content=Photo evidence of incident" \
  -F "image=@/path/to/photo.jpg" \
  -F "location=Main Street"
```

#### 6. Score an Event
```bash
curl -X POST http://localhost:8000/api/v1/events/score \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Suspicious package found",
    "description": "Unattended bag near school",
    "location": "Downtown School",
    "time": "2025-10-15T14:00:00Z"
  }'
```

Response:
```json
{
  "score": 7.5,
  "recommendations": [
    "HIGH RISK: Enhanced monitoring required",
    "Event is happening soon - immediate monitoring recommended",
    "Event in high-traffic area - coordinate with local authorities",
    "Alert law enforcement"
  ]
}
```

#### 7. Create Alert (moderator+)
```bash
curl -X POST http://localhost:8000/api/v1/alerts/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Security Alert",
    "message": "Enhanced security measures in effect",
    "alert_type": "both"
  }'
```

## Testing Advanced Filters

### Filter incidents by severity and status
```bash
curl -X GET "http://localhost:8000/api/v1/incidents/?severity=high&status=open" \
  -H "Authorization: Bearer $TOKEN"
```

### Filter by date range
```bash
curl -X GET "http://localhost:8000/api/v1/incidents/?start_date=2025-10-01T00:00:00Z&end_date=2025-10-15T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

### Keyword search
```bash
curl -X GET "http://localhost:8000/api/v1/incidents/?keyword=security" \
  -H "Authorization: Bearer $TOKEN"
```

### Combined filters with pagination
```bash
curl -X GET "http://localhost:8000/api/v1/incidents/?severity=high&status=open&keyword=threat&page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN"
```

## Run Tests

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run all tests
pytest

# Run with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_auth.py
pytest tests/test_incidents.py
```

## Common Tasks

### View Audit Logs (admin only)
```bash
curl -X GET http://localhost:8000/api/v1/audit/ \
  -H "Authorization: Bearer $TOKEN"
```

### Get Current User Info
```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### Health Check
```bash
curl http://localhost:8000/health
```

## TypeScript Client

To use the TypeScript client in your frontend:

```bash
cd packages/shared
npm install
npm run build
```

Then in your Next.js app:

```typescript
import { createClient } from '@shomer/shared';

const client = createClient('http://localhost:8000');

// Login
const { access_token } = await client.login({
  username: 'admin',
  password: 'admin123'
});

// List incidents
const incidents = await client.listIncidents({
  severity: 'high',
  page: 1,
  page_size: 20
});
```

## Troubleshooting

### Database connection error
- Check PostgreSQL is running: `docker-compose ps` or `systemctl status postgresql`
- Verify DATABASE_URL in `.env`

### Module not found errors
- Run `pip install -e .` from `apps/api` directory

### Permission denied on /uploads
- Create directory: `mkdir -p uploads/tips`
- Check permissions: `chmod 755 uploads`

### Tests failing
- Make sure to run from `apps/api` directory
- Database doesn't need to be running (tests use SQLite in-memory)

## Next Steps

1. **Explore the API**: Use Swagger UI at http://localhost:8000/docs
2. **Read Full Docs**: See README.md for detailed documentation
3. **Deploy**: See DEPLOYMENT.md for production setup
4. **Integrate**: Use TypeScript client in your frontend

## Support

For detailed documentation, see:
- `README.md` - Complete API documentation
- `DEPLOYMENT.md` - Production deployment guide
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details

Happy coding! 🚀

