# GitHub Actions Workflows

This directory contains CI/CD workflows for automated testing, security scanning, and deployment.

## Workflows

### 1. CI (`ci.yml`)

**Triggers**: Push to `main`/`develop`, Pull Requests

**Matrix Testing**:
- **API**: Python 3.11, 3.12
- **Web**: Node 18, 20
- **Shared**: Node 18, 20

**Steps**:
1. **Install Dependencies**: Cache-optimized dependency installation
2. **Lint**: Ruff (API), ESLint (Web)
3. **Format Check**: Black, isort (API), Prettier (Web)
4. **Type Check**: MyPy (API), TypeScript (Web)
5. **Test**: Pytest with coverage (API), Jest (Web)
6. **Integration Tests**: Full stack testing with Docker Compose
7. **Security Scan**: Trivy, Gitleaks
8. **Docker Build Test**: Verify images build successfully

**Services**:
- PostgreSQL 15
- Redis 7

**Coverage**: Uploads to Codecov

### 2. Docker Build & Push (`docker.yml`)

**Triggers**: Version tags (`v*`)

**Multi-Arch Builds**:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64)

**Images Built**:
- `ghcr.io/<owner>/<repo>/api`
- `ghcr.io/<owner>/<repo>/web`

**Image Tags**:
- `v1.2.3` - Exact version
- `v1.2` - Major.minor
- `v1` - Major version
- `sha-abc123` - Git commit SHA
- `latest` - Latest release

**Steps**:
1. **Checkout**: Clone repository
2. **Setup QEMU**: Multi-arch emulation
3. **Setup Buildx**: Advanced Docker builds
4. **Login to GHCR**: GitHub Container Registry
5. **Extract Metadata**: Version tags and labels
6. **Build & Push**: Multi-arch images with caching
7. **Attestation**: Build provenance
8. **Create Release**: GitHub release with notes

**Permissions Required**:
- `contents: read` - Read repository
- `packages: write` - Push to GHCR
- `id-token: write` - Attestation

### 3. Security Scanning (`security.yml`)

**Triggers**: 
- Push to `main`/`develop`
- Pull Requests
- Weekly schedule (Mondays)
- Manual dispatch

**Scans**:
1. **CodeQL**: Code analysis (Python, JavaScript)
2. **Dependency Review**: Check for vulnerable dependencies
3. **Trivy**: Filesystem vulnerability scanning
4. **Gitleaks**: Secret detection

**Severity Levels**: CRITICAL, HIGH

## Required Secrets

### GitHub Container Registry (GHCR)

**No secrets required!** The workflow uses `GITHUB_TOKEN` which is automatically provided.

To enable package publishing:
1. Go to repository Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"

### Optional Secrets

| Secret | Description | Required |
|--------|-------------|----------|
| `CODECOV_TOKEN` | Upload coverage to Codecov | No |

## Workflow Features

### Dependency Caching

All workflows use GitHub Actions cache for:
- **Python**: pip packages
- **Node**: npm packages
- **Docker**: Build layers

### Concurrency Control

CI workflow uses concurrency groups to:
- Cancel in-progress runs for the same PR
- Save runner minutes
- Faster feedback

### Matrix Strategy

Test across multiple versions:
- Python: 3.11, 3.12
- Node: 18, 20

Ensures compatibility across versions.

### Docker Layer Caching

Docker builds use GitHub Actions cache:
- Faster builds (reuse layers)
- Reduced bandwidth
- Better CI performance

### Security Features

- **SARIF Upload**: Security results to GitHub Security tab
- **Dependency Review**: Block PRs with vulnerable deps
- **Secret Scanning**: Prevent credential leaks
- **CodeQL**: Advanced code analysis

## Triggering Workflows

### CI Workflow

Runs automatically on:
```bash
# Push to main or develop
git push origin main

# Open pull request
gh pr create
```

### Docker Workflow

Trigger with version tag:
```bash
# Create tag
git tag v1.0.0
git push origin v1.0.0

# Or create release on GitHub
gh release create v1.0.0 --generate-notes
```

### Security Workflow

Runs automatically:
- On push/PR
- Weekly on Mondays
- Manual trigger via GitHub UI

## Monitoring Workflows

### GitHub UI

1. Go to repository → Actions tab
2. View workflow runs
3. Click run to see details

### Status Badges

Add to README:

```markdown
![CI](https://github.com/your-org/shomer/workflows/CI/badge.svg)
![Docker](https://github.com/your-org/shomer/workflows/Docker%20Build%20%26%20Push/badge.svg)
![Security](https://github.com/your-org/shomer/workflows/Security%20Scanning/badge.svg)
```

### Email Notifications

Configure in GitHub Settings → Notifications:
- Workflow failures
- Successful first-time deployments
- Security alerts

## Troubleshooting

### CI Failures

**Test Failures**:
1. Check test logs in workflow run
2. Run tests locally: `make test`
3. Verify database/Redis connection

**Lint Failures**:
1. Run locally: `make lint`
2. Auto-fix: `make format`
3. Check specific tool (ruff, eslint)

**Type Check Failures**:
1. Run locally: `mypy app/` or `npm run type-check`
2. Fix type errors
3. Add type stubs if missing

### Docker Build Failures

**Build Errors**:
1. Check Dockerfile syntax
2. Verify base images exist
3. Test locally: `docker build -t test .`

**Push Errors**:
1. Check repository permissions
2. Verify GITHUB_TOKEN has package write
3. Check if package visibility is correct

**Multi-arch Failures**:
1. Check QEMU setup
2. Verify platform support
3. Test specific platform: `docker buildx build --platform linux/arm64 .`

### Security Scan Failures

**Vulnerable Dependencies**:
1. Update dependencies: `pip install -U <package>`
2. Check security advisories
3. Review Dependabot PRs

**Secret Detection**:
1. Remove secrets from code
2. Use environment variables
3. Update .gitignore

**CodeQL Issues**:
1. Review security findings
2. Fix code issues
3. Add exceptions if false positive

## Best Practices

### 1. Version Tagging

Use semantic versioning:
```bash
v1.0.0  # Major.Minor.Patch
v1.1.0  # New features
v1.1.1  # Bug fixes
v2.0.0  # Breaking changes
```

### 2. Commit Messages

Follow conventional commits:
```
feat: add user authentication
fix: resolve database connection issue
docs: update deployment guide
ci: add CodeQL scanning
```

### 3. Pull Requests

- Wait for CI to pass before merging
- Review security scan results
- Update documentation
- Add tests for new features

### 4. Security

- Never commit secrets
- Review Dependabot PRs weekly
- Check security tab regularly
- Enable branch protection

### 5. Performance

- Use caching effectively
- Cancel obsolete runs
- Minimize workflow run time
- Use matrix strategy wisely

## Extending Workflows

### Add New Test

Edit `ci.yml`:
```yaml
- name: My custom test
  run: |
    npm run custom-test
```

### Add New Build Step

Edit `docker.yml`:
```yaml
- name: Custom build step
  run: |
    echo "Custom logic"
```

### Add New Environment

Create new workflow file:
```yaml
name: Staging Deploy
on:
  push:
    branches: [staging]
jobs:
  deploy:
    # ... deployment steps
```

## Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [CodeQL](https://codeql.github.com/)
- [Dependabot](https://docs.github.com/en/code-security/dependabot)
- [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

## Support

For issues with workflows:
1. Check workflow logs
2. Review this documentation
3. Open an issue on GitHub
4. Contact the team

---

**Maintained by**: Shomer DevOps Team
**Last Updated**: 2025-01-14

