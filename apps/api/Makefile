# Makefile for Shomer API

.PHONY: help install dev test clean migrate seed docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Start development server"
	@echo "  make test        - Run tests"
	@echo "  make test-cov    - Run tests with coverage"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed database with initial data"
	@echo "  make clean       - Clean up generated files"
	@echo "  make lint        - Run linters"
	@echo "  make format      - Format code"

install:
	pip install -e .
	pip install -e ".[dev]"

dev:
	python run.py

test:
	pytest

test-cov:
	pytest --cov=app --cov-report=html --cov-report=term

migrate:
	alembic upgrade head

migrate-create:
	@read -p "Enter migration message: " msg; \
	alembic revision --autogenerate -m "$$msg"

seed:
	python seed.py

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage

lint:
	ruff check .
	mypy app

format:
	black .
	isort .

docker-up:
	cd ../.. && docker-compose up -d db redis

docker-down:
	cd ../.. && docker-compose down

