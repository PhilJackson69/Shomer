# Docker Configuration

## Local Development

The main `docker-compose.yml` file in the root directory is used for local development.

### Quick Start

```bash
# Start all services
docker compose up --build

# Start in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Clean up volumes
docker compose down -v
```

### Services

- **db**: PostgreSQL 16 database
- **redis**: Redis 7 cache
- **api**: FastAPI backend service
- **web**: Next.js frontend application

### Default Credentials

See `.env.example` in the root directory for all configuration options.

**Default admin user** (seeded in database):
- Username: `admin`
- Password: `admin123`
- Email: `admin@shomer.local`
- Role: `admin`

### Troubleshooting

#### Database connection issues

```bash
# Check database health
docker compose ps db

# View database logs
docker compose logs db

# Restart database
docker compose restart db
```

#### API not starting

```bash
# Check API logs
docker compose logs api

# Rebuild API container
docker compose up --build api
```

#### Web app not accessible

```bash
# Check web logs
docker compose logs web

# Rebuild web container
docker compose up --build web
```

## Production Deployment

For production deployment, consider:

1. **Security**:
   - Change all default passwords
   - Use proper secrets management
   - Enable SSL/TLS
   - Configure firewall rules

2. **Scalability**:
   - Use container orchestration (Kubernetes, ECS)
   - Implement load balancing
   - Configure auto-scaling
   - Use managed database services

3. **Monitoring**:
   - Set up logging aggregation
   - Configure alerting
   - Implement health checks
   - Monitor resource usage

4. **Backup**:
   - Regular database backups
   - Disaster recovery plan
   - Point-in-time recovery

