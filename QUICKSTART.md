# Shomer Quick Start Guide

Get Shomer running in **5 minutes** or less! ⚡

## Prerequisites Check

Before starting, verify you have:

- [ ] [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- [ ] Terminal/Command Prompt access
- [ ] Internet connection for downloading images

**Check Docker:**
```bash
docker --version
docker compose version
```

You should see version numbers (Docker 24+ and Compose 2.0+).

## Step 1: Get the Code

```bash
# Clone the repository
git clone https://github.com/your-org/shomer.git
cd shomer
```

## Step 2: Start Everything

That's it! Just run:

```bash
docker compose up --build
```

**What's happening:**
- 🐘 PostgreSQL database is starting...
- 🔴 Redis cache is starting...
- 🐍 FastAPI backend is starting...
- ⚛️  Next.js frontend is starting...

**Wait for this message:**
```
shomer-web   | ▲ Next.js 15.0.0
shomer-web   | - Local:        http://localhost:3000
shomer-api   | INFO:     Application startup complete.
```

## Step 3: Access the App

Open your browser:

### 🌐 Web Interface
http://localhost:3000

### 📚 API Documentation
http://localhost:8000/docs

### 🏥 Health Check
http://localhost:8000/health

## Step 4: Login

Use the default admin credentials:

- **Username:** `admin`
- **Password:** `admin123`

⚠️ **Change these immediately in production!**

## Step 5: Explore

### Test the API

```bash
# Health check
curl http://localhost:8000/health

# Login and get token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use the token to get current user
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create a New User

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "username": "newuser",
    "password": "securepassword",
    "full_name": "New User"
  }'
```

## Common Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v

# View logs
docker compose logs -f

# Restart a specific service
docker compose restart api

# Check service status
docker compose ps
```

## Troubleshooting

### Port Already in Use

If you see "port already allocated":

```bash
# Find what's using the port (example for 8000)
# On Mac/Linux:
lsof -i :8000

# On Windows:
netstat -ano | findstr :8000

# Kill the process or change the port in docker-compose.yml
```

### Database Connection Failed

```bash
# Check if database is healthy
docker compose ps db

# View database logs
docker compose logs db

# Restart database
docker compose restart db
```

### API Won't Start

```bash
# Check API logs
docker compose logs api

# Rebuild API container
docker compose up --build api
```

### Web Won't Start

```bash
# Check web logs
docker compose logs web

# Rebuild web container
docker compose up --build web
```

## Next Steps

### 🎓 Learn More

- Read the [full README](./README.md)
- Check out [Architecture Decisions](./docs/adr/)
- Review [Security Policy](./docs/SECURITY.md)

### 👨‍💻 Start Developing

```bash
# Set up development environment
make setup

# Run in development mode
make dev

# Run tests
make test
```

### 🚀 Deploy to Production

See [Deployment Guide](./README.md#deployment) for:
- Cloud deployment options
- Production checklist
- Security hardening

## Support

Need help?

- 📖 [Documentation](./docs/)
- 🐛 [Report a Bug](https://github.com/your-org/shomer/issues/new?template=bug_report.md)
- 💡 [Request a Feature](https://github.com/your-org/shomer/issues/new?template=feature_request.md)
- 💬 [Discussions](https://github.com/your-org/shomer/discussions)

---

**🎉 Congratulations!** You now have Shomer running locally. Happy coding!

