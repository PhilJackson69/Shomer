# Infrastructure

Docker Compose configuration for running Shomer locally or in production.

## Quick Start

```bash
# From the infra directory
cp ../.env.example ../.env
docker compose up --build
```

Access:
- **Web**: http://localhost:3000
- **API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001

**Login**: `admin@shomer.local` / `admin123`

## Services

| Service | Port | Description |
|---------|------|-------------|
| **db** | 5432 | PostgreSQL 15 database |
| **redis** | 6379 | Redis cache and queue |
| **minio** | 9000, 9001 | S3-compatible storage (dev only) |
| **api** | 8000 | FastAPI backend |
| **worker** | - | Background job worker (RQ) |
| **web** | 3000 | Next.js frontend |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │  Web   │  │  API   │  │ Worker │  │ MinIO  │       │
│  │ :3000  │  │ :8000  │  │  (RQ)  │  │ :9000  │       │
│  └────┬───┘  └───┬────┘  └───┬────┘  └───┬────┘       │
│       │          │            │            │            │
│       └──────────┴────────────┴────────────┘            │
│                  │            │                         │
│          ┌───────┴────┐  ┌────┴─────┐                  │
│          │     DB     │  │  Redis   │                  │
│          │   :5432    │  │  :6379   │                  │
│          └────────────┘  └──────────┘                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required

```bash
# Database
POSTGRES_USER=shomer
POSTGRES_PASSWORD=shomer_dev_password
POSTGRES_DB=shomer

# Security (CHANGE IN PRODUCTION!)
API_SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET=dev-jwt-secret-change-in-production
```

### Optional (Development)

```bash
# Storage (MinIO for dev)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Retention
TIP_RETENTION_DAYS=14
ENABLE_RETENTION_SCHEDULER=true

# Alert Services
TWILIO_ACCOUNT_SID=
SENDGRID_API_KEY=
```

## Development

### Start Services

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Rebuild and start
docker compose up --build

# Start specific services
docker compose up db redis api
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f worker
```

### Execute Commands

```bash
# Run migrations
docker compose exec api alembic upgrade head

# Create migration
docker compose exec api alembic revision --autogenerate -m "Description"

# Python shell
docker compose exec api python

# Database shell
docker compose exec db psql -U shomer -d shomer

# Redis CLI
docker compose exec redis redis-cli
```

### Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes (DESTRUCTIVE!)
docker compose down -v
```

## Production

Use the production override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production Differences

- **No MinIO**: Use real S3 instead
- **No hot-reload**: Optimized production builds
- **No volume mounts**: Code is in container
- **Multi-worker API**: 4 uvicorn workers
- **Restart policies**: Auto-restart on failure

### Production Environment

```bash
# Required changes for production
ENVIRONMENT=production

# Use real S3 (remove AWS_ENDPOINT_URL)
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=your-bucket
AWS_REGION=us-east-1

# Strong secrets (generate with: openssl rand -base64 32)
API_SECRET_KEY=<strong-random-secret>
JWT_SECRET=<strong-random-secret>
POSTGRES_PASSWORD=<strong-random-password>

# Public URLs
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WEB_URL=https://yourdomain.com
```

## Troubleshooting

### Database Connection Failed

```bash
# Check if database is running
docker compose ps db

# View database logs
docker compose logs db

# Restart database
docker compose restart db
```

### API Not Starting

```bash
# Check logs
docker compose logs api

# Common issues:
# - Database not ready: Wait for health check
# - Migration failed: Check migration files
# - Import error: Check dependencies in pyproject.toml
```

### Web Not Building

```bash
# Check logs
docker compose logs web

# Rebuild web image
docker compose build web

# Clear Next.js cache
docker compose exec web rm -rf .next
docker compose restart web
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker compose logs worker

# Check Redis connection
docker compose exec worker python -c "import redis; r=redis.from_url('redis://redis:6379/0'); print(r.ping())"

# Restart worker
docker compose restart worker
```

### MinIO Bucket Not Created

```bash
# Create bucket manually
docker compose exec minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker compose exec minio mc mb local/shomer-uploads
docker compose exec minio mc anonymous set download local/shomer-uploads
```

### Port Already in Use

```bash
# Check what's using the port
lsof -i :8000  # macOS/Linux
netstat -ano | findstr :8000  # Windows

# Use different ports in .env or docker-compose.yml
```

## Health Checks

All services include health checks:

```bash
# Check service health
docker compose ps

# API health
curl http://localhost:8000/health

# Database health
docker compose exec db pg_isready -U shomer

# Redis health
docker compose exec redis redis-cli ping

# MinIO health
curl http://localhost:9000/minio/health/live
```

## Volumes

Persistent data is stored in Docker volumes:

```bash
# List volumes
docker volume ls | grep shomer

# Inspect volume
docker volume inspect infra_postgres_data

# Backup database
docker compose exec db pg_dump -U shomer shomer > backup.sql

# Restore database
docker compose exec -T db psql -U shomer shomer < backup.sql

# Remove volumes (DESTRUCTIVE!)
docker compose down -v
```

## Networks

Services communicate via the `shomer-network`:

```bash
# List networks
docker network ls | grep shomer

# Inspect network
docker network inspect infra_shomer-network

# Check connectivity
docker compose exec api ping db
docker compose exec api ping redis
```

## Performance

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Scaling Workers

```bash
# Scale worker to 3 instances
docker compose up --scale worker=3 -d
```

## Scripts

Helper scripts in `infra/scripts/`:

- `create-minio-bucket.sh` - Create MinIO bucket for development
- `wait-for-it.sh` - Wait for service to be ready

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Start services
  run: |
    cd infra
    docker compose up -d
    docker compose exec -T api alembic upgrade head

- name: Run tests
  run: |
    docker compose exec -T api pytest
    docker compose exec -T web npm test

- name: Stop services
  run: docker compose down -v
```

## Security Notes

🔒 **Development Only**

- Default credentials are for development only
- MinIO is exposed without authentication
- No SSL/TLS termination
- Debug mode enabled

🔐 **Production Requirements**

- Change all default passwords
- Use managed database (RDS, Cloud SQL)
- Use managed cache (ElastiCache, Memorystore)
- Use real S3 (not MinIO)
- Add reverse proxy (nginx, traefik)
- Enable SSL/TLS
- Set up firewall rules
- Configure secrets management
- Enable audit logging
- Set up monitoring

## Further Reading

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [API Documentation](../apps/api/README.md)
- [Web Documentation](../apps/web/README.md)
- [Security Policy](../docs/SECURITY.md)

---

**Need help?** Open an issue on GitHub or contact support@shomer.local

