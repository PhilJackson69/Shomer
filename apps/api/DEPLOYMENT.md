# Deployment Guide for Shomer API

## Pre-Deployment Checklist

### 1. Environment Configuration

Create a production `.env` file with secure values:

```bash
# Generate secure secrets
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Update these critical variables:
- `API_SECRET_KEY` - Use generated secret
- `JWT_SECRET` - Use generated secret
- `POSTGRES_PASSWORD` - Use strong password
- `DATABASE_URL` - Point to production database

### 2. Database Setup

```bash
# Run migrations
alembic upgrade head

# Seed initial admin user (optional, but recommended)
python seed.py
```

### 3. External Services (Optional)

#### Twilio (SMS Alerts)
```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

#### SendGrid (Email Alerts)
```bash
SENDGRID_API_KEY=your_api_key
```

#### S3 Compatible Storage (File Uploads)
For production, implement S3 storage in `apps/api/app/api/v1/endpoints/tips.py`

## Deployment Options

### Option 1: Docker Compose (Recommended for Testing)

```bash
# From repository root
docker-compose up -d
```

This starts:
- API service on port 8000
- PostgreSQL database
- Redis cache

### Option 2: Systemd Service (Production)

Create `/etc/systemd/system/shomer-api.service`:

```ini
[Unit]
Description=Shomer API Service
After=network.target postgresql.service

[Service]
Type=simple
User=shomer
WorkingDirectory=/opt/shomer/apps/api
Environment="PATH=/opt/shomer/venv/bin"
ExecStart=/opt/shomer/venv/bin/python run.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable shomer-api
sudo systemctl start shomer-api
sudo systemctl status shomer-api
```

### Option 3: Kubernetes

See `infra/k8s/` directory for Kubernetes manifests (if available).

Key components:
- API Deployment with 3+ replicas
- PostgreSQL StatefulSet
- Redis Deployment
- Ingress for HTTPS

### Option 4: Cloud Platforms

#### AWS

1. **Elastic Beanstalk**: Deploy with provided `Dockerfile`
2. **ECS/Fargate**: Use container-based deployment
3. **Lambda**: Not recommended (stateful app)

Required AWS services:
- RDS PostgreSQL
- ElastiCache Redis
- S3 for file uploads
- ALB for load balancing

#### Google Cloud Platform

1. **Cloud Run**: Deploy containerized app
2. **GKE**: Kubernetes deployment

Required GCP services:
- Cloud SQL PostgreSQL
- Cloud Memorystore Redis
- Cloud Storage for files

#### Azure

1. **App Service**: Deploy with Docker
2. **AKS**: Kubernetes deployment

Required Azure services:
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Azure Blob Storage

## Security Hardening

### 1. HTTPS/TLS

Always use HTTPS in production. Configure via:
- Nginx/Apache reverse proxy
- Cloud load balancer
- Let's Encrypt certificates

### 2. CORS Configuration

Update `apps/api/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Specific domains only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. Rate Limiting

Implement rate limiting at:
- Application level (middleware)
- Reverse proxy (Nginx limit_req)
- API Gateway

### 4. Database Security

- Use SSL connections
- Enable connection pooling
- Implement read replicas for scaling
- Regular backups with point-in-time recovery

### 5. Secret Management

Use a secrets manager:
- AWS Secrets Manager
- Google Secret Manager
- Azure Key Vault
- HashiCorp Vault

## Monitoring & Logging

### 1. Application Logs

Configure structured logging:

```python
# Add to main.py
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### 2. Performance Monitoring

Integrate APM tools:
- New Relic
- DataDog
- Sentry (error tracking)
- Prometheus + Grafana

### 3. Health Checks

Built-in endpoints:
- `GET /health` - Basic health check
- `GET /` - API information

Configure monitoring to alert on:
- Response time > 1s
- Error rate > 1%
- 5xx responses

### 4. Database Monitoring

Monitor:
- Connection pool usage
- Query performance
- Slow query log
- Disk usage

## Scaling Strategy

### Horizontal Scaling

1. Run multiple API instances behind load balancer
2. Share session state via Redis
3. Use read replicas for database

### Vertical Scaling

Upgrade instance resources:
- CPU: 2-4 cores minimum
- RAM: 4-8 GB minimum
- Storage: SSD recommended

### Database Scaling

1. **Read Replicas**: For read-heavy workloads
2. **Connection Pooling**: PgBouncer recommended
3. **Caching**: Redis for frequent queries
4. **Partitioning**: For large tables (incidents, audit logs)

## Backup Strategy

### Database Backups

```bash
# Automated daily backups
pg_dump -U shomer -d shomer | gzip > backup_$(date +%Y%m%d).sql.gz

# Point-in-time recovery
# Enable WAL archiving in PostgreSQL
```

### File Backups

If using local storage (dev only), backup `uploads/` directory.
Production should use S3 with versioning enabled.

### Backup Retention

- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks
- Monthly backups: Keep 12 months

## Performance Optimization

### 1. Database Indexes

Already configured on:
- User email, username
- Incident severity, status, created_at
- All primary keys

Monitor slow queries and add indexes as needed.

### 2. Query Optimization

Use SQLAlchemy query profiling:

```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "before_cursor_execute")
def receive_before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())
```

### 3. Caching

Implement caching for:
- User profiles
- Public incidents list
- Frequently accessed data

### 4. Connection Pooling

Configure in `app/db/base.py`:

```python
engine = create_engine(
    str(settings.DATABASE_URL),
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify PostgreSQL is running
   - Check network/firewall rules

2. **Authentication Failures**
   - Verify JWT_SECRET is set
   - Check token expiration
   - Validate user credentials

3. **Performance Issues**
   - Enable query logging
   - Check database indexes
   - Monitor connection pool
   - Review slow query log

4. **File Upload Failures**
   - Check disk space
   - Verify upload directory permissions
   - Check file size limits

### Log Analysis

```bash
# View recent errors
journalctl -u shomer-api -n 100 --no-pager | grep ERROR

# Follow logs in real-time
journalctl -u shomer-api -f

# Check specific time range
journalctl -u shomer-api --since "1 hour ago"
```

## Rollback Procedure

If issues occur after deployment:

1. **Application Rollback**
   ```bash
   # Revert to previous version
   git checkout previous-tag
   docker-compose up -d --build
   ```

2. **Database Rollback**
   ```bash
   # Rollback last migration
   alembic downgrade -1
   ```

3. **Full System Restore**
   ```bash
   # Restore from backup
   psql -U shomer -d shomer < backup_YYYYMMDD.sql
   ```

## Post-Deployment Verification

Run these checks after deployment:

```bash
# 1. Health check
curl https://api.yourdomain.com/health

# 2. Authentication
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 3. Run smoke tests
pytest tests/test_main.py

# 4. Check logs for errors
journalctl -u shomer-api --since "5 minutes ago" | grep ERROR
```

## Support & Maintenance

### Regular Maintenance Tasks

- Weekly: Review error logs
- Weekly: Check disk usage
- Monthly: Review and optimize slow queries
- Monthly: Update dependencies (security patches)
- Quarterly: Review and update secrets
- Quarterly: Test backup restoration

### Monitoring Alerts

Configure alerts for:
- API downtime
- High error rate (>1%)
- Database connection failures
- Disk usage >80%
- Memory usage >90%
- Certificate expiration (30 days)

## Additional Resources

- API Documentation: https://api.yourdomain.com/docs
- GitHub Repository: [Link to repo]
- Support Email: support@yourdomain.com

