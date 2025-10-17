# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Shomer project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## Format

We use the format proposed by Michael Nygard:

- **Title**: Short noun phrase
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Context**: Forces at play, constraints, requirements
- **Decision**: The decision we made
- **Consequences**: Results of the decision, both positive and negative

## Index

1. [ADR-001: Use Monorepo Structure](./001-monorepo-structure.md)
2. [ADR-002: FastAPI for Backend](./002-fastapi-backend.md)
3. [ADR-003: Next.js for Frontend](./003-nextjs-frontend.md)
4. [ADR-004: PostgreSQL as Primary Database](./004-postgresql-database.md)
5. [ADR-005: Role-Based Access Control](./005-rbac-model.md)

## Creating a New ADR

1. Copy the template: `cp template.md XXX-title.md`
2. Fill in the sections
3. Submit for review
4. Update the index above when accepted

