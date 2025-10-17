# ADR-004: PostgreSQL as Primary Database

## Status

Accepted

Date: 2025-01-14

## Context

We need to choose a primary database for Shomer. Requirements:

- ACID compliance for data integrity
- Strong relational model for user/audit data
- Good performance for read-heavy workloads
- JSON support for flexible audit log details
- Full-text search capabilities
- Mature ecosystem and tooling
- Production-ready with replication support
- Open source with managed service options

## Decision

We will use **PostgreSQL 16** as the primary database.

Additional data stores:
- **Redis** for caching and session storage
- **PostgreSQL JSON columns** for flexible audit log data

## Consequences

### Positive

- **Data Integrity**: Strong ACID guarantees, foreign key constraints
- **Rich Features**: JSON support, full-text search, array types
- **Performance**: Excellent query optimizer, efficient indexing
- **Ecosystem**: Mature tools (pgAdmin, pg_dump, extensions)
- **SQL Compatibility**: Standard SQL with PostgreSQL extensions
- **Open Source**: No vendor lock-in, many hosting options
- **Scalability**: Read replicas, logical replication, partitioning
- **Extensions**: PostGIS, pg_trgm, etc. for advanced features

### Negative

- **Complexity**: More complex than NoSQL for simple use cases
- **Horizontal Scaling**: Harder to scale writes than NoSQL databases
- **Schema Migrations**: Requires careful migration planning
- **Resource Usage**: Can be memory-intensive under heavy load

### Neutral

- **Relational Model**: Requires upfront schema design (good for this project)
- **Backups**: Need to set up backup strategy (standard for any database)

## Alternatives Considered

### Alternative 1: MySQL/MariaDB

**Pros**: Popular, good ecosystem, many hosting options

**Cons**: Weaker JSON support, less advanced features, licensing concerns (MySQL)

**Why not chosen**: PostgreSQL has better JSON support and more advanced features needed for audit logs.

### Alternative 2: MongoDB

**Pros**: Flexible schema, easy horizontal scaling, good for document storage

**Cons**: Weaker ACID guarantees, no joins, less mature for transactional workloads

**Why not chosen**: Need strong ACID guarantees and relational integrity for user/audit data.

### Alternative 3: SQLite

**Pros**: Zero configuration, embedded, perfect for development

**Cons**: Single writer, no network access, limited concurrency

**Why not chosen**: Not suitable for multi-user production application.

### Alternative 4: Amazon Aurora / Google Cloud SQL

**Pros**: Managed service, automatic backups, high availability

**Cons**: Vendor lock-in, higher cost, complex pricing

**Why not chosen**: Want flexibility to deploy on any platform. Can use managed PostgreSQL later without changing application code.

## Data Model Highlights

**Users Table**:
- Core user information (email, username, role)
- bcrypt password hashes
- Timestamps for auditing

**Audit Logs Table**:
- User ID (foreign key)
- Action, resource type, resource ID
- JSON details column for flexible data
- IP address and user agent for security
- Indexed timestamp for fast queries

**Redis Usage**:
- Session tokens (TTL-based expiration)
- Rate limiting counters
- Cached queries (short TTL)

## Migration Strategy

- **Alembic** for schema migrations
- Forward-only migrations (no down migrations in production)
- Test migrations on staging before production
- Backup before every production migration
- Schema versioning in migrations table

## References

- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Alembic documentation](https://alembic.sqlalchemy.org/)
- [PostgreSQL JSON functions](https://www.postgresql.org/docs/current/functions-json.html)

