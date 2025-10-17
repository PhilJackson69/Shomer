# ADR-002: FastAPI for Backend

## Status

Accepted

Date: 2025-01-14

## Context

We need to choose a backend framework for the Shomer API. Requirements:

- Modern async/await support for high concurrency
- Strong type safety for API contracts
- Automatic API documentation (OpenAPI/Swagger)
- Python ecosystem (team expertise, libraries)
- Good performance for real-time features
- Easy integration with PostgreSQL and Redis
- Production-ready with good security practices

## Decision

We will use **FastAPI** as the backend framework.

Key features we'll leverage:
- Pydantic for request/response validation
- Automatic OpenAPI schema generation
- Dependency injection for clean code
- SQLAlchemy for database ORM
- Alembic for database migrations
- Python 3.11+ for performance

## Consequences

### Positive

- **Type Safety**: Pydantic models provide runtime validation
- **Auto Documentation**: OpenAPI schema generated automatically
- **Performance**: FastAPI is one of the fastest Python frameworks
- **Modern Python**: Uses latest Python features (type hints, async/await)
- **Developer Experience**: Excellent error messages, auto-completion support
- **Ecosystem**: Rich ecosystem of extensions and integrations
- **TypeScript Generation**: Can generate TypeScript client from OpenAPI schema

### Negative

- **Async Complexity**: Async code can be harder to debug
- **ORM Limitations**: SQLAlchemy async support still maturing
- **Breaking Changes**: FastAPI still evolving, occasional breaking changes
- **Learning Curve**: Developers need to understand Pydantic and dependency injection

### Neutral

- **Python**: Choosing Python locks us into Python ecosystem (acceptable for this project)
- **Microservices**: FastAPI works well for microservices, but may be overkill for monolithic apps

## Alternatives Considered

### Alternative 1: Django + Django REST Framework

**Pros**: Mature ecosystem, batteries included, admin interface, excellent ORM

**Cons**: Slower than FastAPI, less modern type support, heavier framework

**Why not chosen**: FastAPI's automatic OpenAPI generation and performance better fits our needs.

### Alternative 2: Flask

**Pros**: Lightweight, mature, large ecosystem, simple to learn

**Cons**: No built-in async support, manual API documentation, less type safety

**Why not chosen**: Lack of modern features (async, type safety, auto-docs) is a significant disadvantage.

### Alternative 3: Node.js (Express/NestJS)

**Pros**: JavaScript everywhere, large ecosystem, good for real-time

**Cons**: Weaker type safety (even with TypeScript), team has Python expertise

**Why not chosen**: Team's Python expertise and need for strong type safety made Python a better choice.

## References

- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [FastAPI performance benchmarks](https://www.techempower.com/benchmarks/)
- [Pydantic documentation](https://docs.pydantic.dev/)

