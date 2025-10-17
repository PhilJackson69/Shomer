# Shomer API Installation Guide

## Prerequisites

- Python 3.11 or higher
- PostgreSQL 12 or higher
- Redis 6 or higher

## Installation Steps

### 1. Install Base Dependencies

```bash
# From the apps/api directory
pip install -e .
```

### 2. Install Development Dependencies

```bash
pip install -e ".[dev]"
```

### 3. (Optional) Install ML Dependencies

For HuggingFace model support in the NLP module:

```bash
pip install -e ".[ml]"
```

Or manually:

```bash
pip install transformers torch
```

**Note**: The NLP module will work without ML dependencies, falling back to rule-based classification only.

## Environment Configuration

1. Copy the example environment file:

```bash
cp env.example .env
```

2. Update `.env` with your configuration:

```env
# Database
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=shomer
DATABASE_URL=postgresql://your_user:your_password@localhost/shomer

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=3600

# API
API_SECRET_KEY=your-api-secret-key
```

## Database Setup

1. Create the database:

```bash
createdb shomer
```

2. Run migrations:

```bash
alembic upgrade head
```

3. (Optional) Seed with test data:

```bash
python seed.py
```

## Running the API

### Development Mode

```bash
# Using uvicorn directly
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the run script
python run.py
```

### Production Mode

```bash
# Using gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

## Testing

### Run All Tests

```bash
pytest
```

### Run Specific Test Files

```bash
pytest tests/test_nlp.py -v
pytest tests/test_nlp_endpoint.py -v
```

### Run with Coverage

```bash
pytest --cov=app --cov=shomer_nlp --cov-report=html
```

## NLP Module Demo

To see the NLP module in action:

```bash
python examples/nlp_demo.py
```

## Verifying Installation

1. Start the API server
2. Visit http://localhost:8000/docs for the API documentation
3. Check the health endpoint:

```bash
curl http://localhost:8000/api/v1/nlp/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "nlp"
}
```

## Troubleshooting

### Issue: Module not found errors

**Solution**: Make sure you're in the `apps/api` directory and have installed the package:
```bash
cd apps/api
pip install -e .
```

### Issue: Database connection errors

**Solution**: Verify PostgreSQL is running and DATABASE_URL is correct:
```bash
psql -h localhost -U your_user -d shomer
```

### Issue: Redis connection errors

**Solution**: Verify Redis is running:
```bash
redis-cli ping
```

### Issue: Transformers/torch import errors

**Solution**: This is expected if ML dependencies aren't installed. The NLP module will automatically fall back to rule-only mode. To enable ML features:
```bash
pip install -e ".[ml]"
```

## Next Steps

- Review the [API documentation](README.md)
- Check the [NLP module README](shomer_nlp/README.md)
- Explore example configurations in `shomer_nlp/config.example.py`
- Read the [deployment guide](DEPLOYMENT.md)

