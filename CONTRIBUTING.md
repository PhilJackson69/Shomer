# Contributing to Shomer

Thank you for your interest in contributing to Shomer! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations can be reported to conduct@shomer.local. All complaints will be reviewed and investigated promptly and fairly.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Git**: Version control
2. **Python 3.11+**: For API development
3. **Node.js 20+**: For web development
4. **pnpm**: Package manager
5. **uv**: Python package installer
6. **Docker**: For local development
7. **Pre-commit**: Installed via `make setup`

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/shomer.git
cd shomer

# Add upstream remote
git remote add upstream https://github.com/original-org/shomer.git
```

### Set Up Development Environment

```bash
# Install all dependencies and pre-commit hooks
make setup

# Start development environment
make dev
```

## Development Process

### 1. Create a Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

### 2. Make Your Changes

#### Code Quality

Run before committing:

```bash
# Format code
make format

# Lint code
make lint

# Type check
make typecheck

# Run tests
make test
```

#### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Examples:**

```bash
git commit -m "feat(api): add user export endpoint"
git commit -m "fix(web): resolve login redirect issue"
git commit -m "docs: update deployment guide"
```

### 3. Keep Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch
git rebase upstream/main

# If conflicts, resolve them and continue
git rebase --continue
```

### 4. Push Your Changes

```bash
git push origin feature/your-feature-name
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] Branch is up to date with main
- [ ] No merge conflicts

### Creating a Pull Request

1. Go to GitHub and create a Pull Request
2. Fill out the PR template completely
3. Link related issues
4. Add appropriate labels
5. Request review from maintainers

### PR Template Checklist

- [ ] **Description**: Clear explanation of changes
- [ ] **Type**: Bug fix, feature, docs, etc.
- [ ] **Testing**: How you tested the changes
- [ ] **Screenshots**: If UI changes
- [ ] **Breaking changes**: If any
- [ ] **Security**: Any security implications

### Review Process

1. **Automated checks**: CI/CD must pass
2. **Code review**: At least one approval required
3. **Discussion**: Address review comments
4. **Approval**: Maintainer approves
5. **Merge**: Squash and merge to main

### After Merge

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Delete feature branch
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## Coding Standards

### Python (API)

**Tools:**
- **black**: Code formatting (line length: 100)
- **isort**: Import sorting
- **ruff**: Fast linting
- **mypy**: Type checking

**Style:**

```python
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse


def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Create a new user.
    
    Args:
        user_data: User creation data
        db: Database session
        
    Returns:
        Created user information
        
    Raises:
        HTTPException: If user already exists
    """
    # Implementation
    ...
```

**Naming:**
- Functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_CASE`
- Private: `_leading_underscore`

### TypeScript (Web)

**Tools:**
- **ESLint**: Linting
- **Prettier**: Formatting
- **TypeScript**: Type checking

**Style:**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { User } from '@shomer/shared';

interface UserProfileProps {
  user: User;
  onUpdate?: (user: User) => void;
}

export function UserProfile({ user, onUpdate }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    // Implementation
  };

  return (
    <div className="space-y-4">
      {/* Component content */}
    </div>
  );
}
```

**Naming:**
- Components: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_CASE`
- Types/Interfaces: `PascalCase`

### SQL/Migrations

**Naming:**
- Tables: `snake_case`, plural (e.g., `users`, `audit_logs`)
- Columns: `snake_case`
- Indexes: `ix_table_column`
- Foreign keys: `fk_table_column`

### Git

**Branch names:**
- Use hyphens: `feature/add-user-export`
- Be descriptive: `fix/login-redirect-loop`
- Keep short: Max 50 characters

**Commit messages:**
- Subject: Max 72 characters
- Body: Wrap at 72 characters
- Use imperative mood: "Add feature" not "Added feature"

## Testing Guidelines

### Test Coverage

Aim for:
- **Unit tests**: 80%+ coverage
- **Integration tests**: Critical paths
- **E2E tests**: Key user flows

### Python Tests (pytest)

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_health_check():
    """Test health check endpoint."""
    client = TestClient(app)
    response = client.get("/health")
    
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.fixture
def test_user(db):
    """Create a test user."""
    user = User(email="test@example.com", username="testuser")
    db.add(user)
    db.commit()
    return user


def test_get_user(test_user):
    """Test getting user by ID."""
    client = TestClient(app)
    response = client.get(f"/users/{test_user.id}")
    
    assert response.status_code == 200
    assert response.json()["username"] == "testuser"
```

### TypeScript Tests (Jest/Vitest)

```typescript
import { render, screen } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('renders user name', () => {
    const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
    
    render(<UserProfile user={user} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('calls onUpdate when save button is clicked', async () => {
    const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
    const onUpdate = jest.fn();
    
    render(<UserProfile user={user} onUpdate={onUpdate} />);
    
    // Test implementation
  });
});
```

### Running Tests

```bash
# All tests
make test

# API tests only
cd apps/api && uv run pytest

# Web tests only
cd apps/web && pnpm test

# With coverage
cd apps/api && uv run pytest --cov
```

## Documentation

### Code Documentation

**Python:**
```python
def complex_function(arg1: str, arg2: int) -> Dict[str, Any]:
    """One-line summary.
    
    Longer description if needed.
    
    Args:
        arg1: Description of arg1
        arg2: Description of arg2
        
    Returns:
        Description of return value
        
    Raises:
        ValueError: When validation fails
    """
```

**TypeScript:**
```typescript
/**
 * One-line summary.
 * 
 * Longer description if needed.
 * 
 * @param arg1 - Description of arg1
 * @param arg2 - Description of arg2
 * @returns Description of return value
 * @throws {Error} When validation fails
 */
function complexFunction(arg1: string, arg2: number): Record<string, any> {
  // Implementation
}
```

### Architecture Decisions

For significant architectural changes, create an ADR:

```bash
cp docs/adr/template.md docs/adr/XXX-your-decision.md
# Fill out the template
# Update docs/adr/README.md index
```

### README Updates

Update relevant READMEs when:
- Adding new features
- Changing setup process
- Adding dependencies
- Modifying configuration

## Community

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas, general discussion
- **Email**: contribute@shomer.local

### Getting Help

1. **Search**: Check existing issues and discussions
2. **Documentation**: Read the docs thoroughly
3. **Ask**: If stuck, open a discussion or issue
4. **Be specific**: Include error messages, steps to reproduce

### Recognition

Contributors are recognized in:
- Release notes
- Contributors list
- GitHub insights

Significant contributors may be invited to become maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Shomer! 🎉

