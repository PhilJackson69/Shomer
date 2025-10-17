# Shomer API Scripts

Operational scripts for the Shomer API.

## Available Scripts

### rotate_secrets.py

**Purpose:** Rotate critical secrets (JWT_SECRET, SIGNED_URL_SECRET) every 30 days.

**Usage:**

```bash
# Dry run (recommended first)
DRY_RUN=true python rotate_secrets.py

# Execute rotation
python rotate_secrets.py

# With Slack notifications
SLACK_WEBHOOK=https://hooks.slack.com/... python rotate_secrets.py
```

**Environment Variables:**
- `SLACK_WEBHOOK` - Webhook URL for Slack notifications (optional)
- `DRY_RUN` - Set to 'true' for dry-run mode (no changes applied)

**Output:**
- New secrets written to `.env.production`
- Slack notification sent (if webhook configured)
- Console output with rotation summary

**Automation:**
- Runs automatically via GitHub Actions on 1st of each month
- Manual trigger available in GitHub Actions UI

**See Also:**
- `.github/workflows/rotate-secrets.yml` - GitHub Actions workflow
- `docs/POST_LAUNCH_MONITORING.md` - Rotation procedures and runbooks

---

## Adding New Scripts

When adding new operational scripts:

1. Place in `apps/api/app/scripts/`
2. Add shebang: `#!/usr/bin/env python3`
3. Include docstring with usage instructions
4. Add to this README
5. Consider automation via GitHub Actions
6. Document in relevant guides

