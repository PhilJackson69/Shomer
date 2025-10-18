# Shomer Makefile
# Common development commands

.PHONY: help setup dev build up down logs clean test lint format security-check security-test api web

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "Shomer Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Initial setup - install all dependencies
	@echo "🔧 Setting up Shomer..."
	@echo "📦 Installing Python dependencies..."
	cd apps/api && pip install -e .
	@echo "📦 Installing Node dependencies..."
	cd apps/web && npm install
	@echo "✅ Setup complete!"

dev: ## Start all services with Docker Compose
	@echo "🚀 Starting Shomer in development mode..."
	cd infra && docker compose up

build: ## Build all Docker images
	@echo "🏗️  Building Docker images..."
	cd infra && docker compose build

up: ## Start all services in background
	@echo "🚀 Starting services in background..."
	cd infra && docker compose up -d
	@echo "✅ Services started!"
	@echo "   Web: http://localhost:3000"
	@echo "   API: http://localhost:8000"
	@echo "   Docs: http://localhost:8000/docs"

down: ## Stop all services
	@echo "🛑 Stopping services..."
	cd infra && docker compose down

logs: ## View logs from all services
	cd infra && docker compose logs -f

clean: ## Remove all containers, volumes, and build artifacts
	@echo "🧹 Cleaning up..."
	cd infra && docker compose down -v
	@echo "✅ Cleanup complete!"

test: ## Run all tests
	@echo "🧪 Running tests..."
	@echo "Testing API..."
	cd apps/api && pytest -v
	@echo "Testing Web..."
	cd apps/web && npm test
	@echo "✅ Tests complete!"

lint: ## Lint all code
	@echo "🔍 Linting code..."
	@echo "Linting API..."
	cd apps/api && ruff check .
	@echo "Linting Web..."
	cd apps/web && npm run lint
	@echo "✅ Linting complete!"

format: ## Format all code
	@echo "✨ Formatting code..."
	@echo "Formatting API..."
	cd apps/api && black . && isort .
	@echo "Formatting Web..."
	cd apps/web && npm run format
	@echo "✅ Formatting complete!"

migrate: ## Run database migrations
	@echo "🗄️  Running migrations..."
	cd infra && docker compose exec api alembic upgrade head
	@echo "✅ Migrations complete!"

seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	cd infra && docker compose exec api python seed.py
	@echo "✅ Seeding complete!"

shell-api: ## Open shell in API container
	cd infra && docker compose exec api /bin/bash

shell-web: ## Open shell in Web container
	cd infra && docker compose exec web /bin/sh

shell-db: ## Open PostgreSQL shell
	cd infra && docker compose exec db psql -U shomer -d shomer

reset: ## Reset database (DESTRUCTIVE!)
	@echo "⚠️  This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "🗑️  Resetting database..."; \
		cd infra && docker compose down -v && docker compose up -d; \
		echo "✅ Reset complete!"; \
	fi

backup-db: ## Backup database to file
	@echo "💾 Backing up database..."
	cd infra && docker compose exec db pg_dump -U shomer shomer > backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup complete!"

status: ## Show status of all services
	@echo "📊 Service Status:"
	cd infra && docker compose ps

# =============================================================================
# Security & Development Commands
# =============================================================================

api: ## Start API server in development mode
	@echo "🚀 Starting API server..."
	cd apps/api && uvicorn app.main:app --reload --port $${API_PORT:-8000}

web: ## Start Web server in development mode
	@echo "🚀 Starting Web server..."
	cd apps/web && npm run dev

security-check: ## Run security-focused checks
	@echo "🔒 Running security checks..."
	@echo "Checking API security headers..."
	@curl -s -I http://localhost:8000/health | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)" || echo "⚠️  API not running or missing headers"
	@echo "Checking Web security headers..."
	@curl -s -I http://localhost:3000 | grep -E "(X-Content-Type-Options|X-Frame-Options)" || echo "⚠️  Web not running or missing headers"
	@echo "Running security tests..."
	cd apps/api && pytest tests/test_security.py -v

security-test: ## Run comprehensive security tests
	@echo "🧪 Running security test suite..."
	cd apps/api && pytest tests/test_security.py tests/test_security_hardening.py -v --tb=short
	@echo "✅ Security tests complete!"

dev-secure: ## Start development with security focus
	@echo "🔒 Starting secure development mode..."
	@echo "Copying environment template..."
	@cp env.example .env || echo "⚠️  .env already exists"
	@echo "Starting services with security middleware..."
	$(MAKE) -j2 api web

validate-secrets: ## Validate secret strength
	@echo "🔐 Validating secret strength..."
	cd apps/api && python -m app.core.security generate
	@echo "✅ Secret validation complete!"
