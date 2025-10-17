# ADR-001: Use Monorepo Structure

## Status

Accepted

Date: 2025-01-14

## Context

We need to organize the Shomer codebase, which consists of:
- Python FastAPI backend
- Next.js frontend
- Shared TypeScript types and API client
- Infrastructure code (Docker, Terraform)
- Documentation

Key considerations:
- Code sharing between frontend and backend (types, schemas)
- Coordinated deployments
- Developer experience
- CI/CD complexity
- Scalability as team grows

## Decision

We will use a monorepo structure with the following layout:

```
/apps/api       - Python FastAPI service
/apps/web       - Next.js frontend
/packages/shared - Shared TypeScript types
/infra          - Infrastructure code
/docs           - Documentation
```

We will use:
- **pnpm workspaces** for JavaScript/TypeScript package management
- **uv** for Python dependency management
- **Makefile** for common tasks across the monorepo

## Consequences

### Positive

- **Code Sharing**: Easy to share types between frontend and backend
- **Atomic Changes**: Can update API and client in a single commit
- **Consistent Tooling**: Single CI/CD pipeline, unified linting/formatting
- **Simplified Versioning**: Single version number for coordinated releases
- **Better Discoverability**: All code in one place, easier for new developers

### Negative

- **Build Complexity**: Need to manage dependencies between packages
- **Larger Repository**: Slower clone times as project grows
- **Tool Limitations**: Some tools don't work well with monorepos
- **Access Control**: Can't easily restrict access to parts of the codebase (not an issue for this project)

### Neutral

- **Learning Curve**: Team needs to understand monorepo workflows
- **Tooling Setup**: Initial investment in monorepo tooling

## Alternatives Considered

### Alternative 1: Multi-repo (Polyrepo)

Separate repositories for API, web, and shared packages.

**Pros**: Clear boundaries, independent versioning, simpler per-repo CI

**Cons**: Difficult to share code, complex versioning, coordinated releases harder

**Why not chosen**: The tight coupling between API and web makes the overhead of multi-repo not worth the benefits.

### Alternative 2: Single App with Backend/Frontend

Everything in one application (e.g., FastAPI serving Next.js).

**Pros**: Simplest deployment, single codebase

**Cons**: Tight coupling, harder to scale independently, conflicting dependencies

**Why not chosen**: Want flexibility to scale and deploy services independently in the future.

## References

- [pnpm workspaces documentation](https://pnpm.io/workspaces)
- [Monorepo tools comparison](https://monorepo.tools/)

