#!/usr/bin/env python3
"""
Secret Rotation Script for Shomer

Rotates critical secrets (JWT, signed URLs) every 30 days.
Stores rotated values in .env.production and broadcasts to Slack.

Usage:
    python apps/api/app/scripts/rotate_secrets.py

Environment Variables:
    SLACK_WEBHOOK - Webhook URL for rotation notifications
    DRY_RUN - If set to 'true', only prints changes without applying
"""

import os
import secrets
import datetime
import sys
from pathlib import Path

# Optional Slack notifications
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    print("⚠ requests not available - Slack notifications disabled")

# Keys to rotate
ROTATE_KEYS = ["JWT_SECRET", "SIGNED_URL_SECRET"]

# Output file
ENV_FILE = Path(".env.production")


def generate_secret(length: int = 32) -> str:
    """Generate a cryptographically secure random secret."""
    return secrets.token_hex(length)


def rotate_secrets(dry_run: bool = False) -> dict:
    """
    Rotate all configured secrets.
    
    Args:
        dry_run: If True, only print changes without applying
        
    Returns:
        Dict of rotated key-value pairs
    """
    rotated = {}
    timestamp = datetime.date.today()
    
    print(f"🔑 Rotating secrets - {timestamp}")
    print(f"{'DRY RUN - ' if dry_run else ''}Generating new values...")
    print()
    
    for key in ROTATE_KEYS:
        val = generate_secret(32)
        rotated[key] = val
        
        # Show truncated value for security
        display_val = val[:8] + "..." + val[-8:]
        print(f"  ✓ {key}: {display_val}")
    
    print()
    
    if not dry_run:
        # Write to .env.production
        try:
            with open(ENV_FILE, "a") as f:
                f.write(f"\n# Rotated {timestamp}\n")
                for key, val in rotated.items():
                    f.write(f"{key}={val}\n")
            
            print(f"✓ Secrets written to {ENV_FILE}")
        except Exception as e:
            print(f"✗ Failed to write secrets: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"ℹ DRY RUN - would write to {ENV_FILE}")
    
    return rotated


def notify_slack(rotated: dict, dry_run: bool = False):
    """
    Send rotation notification to Slack.
    
    Args:
        rotated: Dict of rotated secrets
        dry_run: If True, only print notification without sending
    """
    webhook = os.getenv("SLACK_WEBHOOK")
    
    if not webhook:
        print("ℹ SLACK_WEBHOOK not set - skipping notification")
        return
    
    if not REQUESTS_AVAILABLE:
        print("⚠ requests library not available - skipping Slack notification")
        return
    
    timestamp = datetime.date.today()
    
    # Create message (without actual secret values)
    keys_rotated = ", ".join(rotated.keys())
    message = {
        "text": f"🔑 Shomer Secrets Rotated",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🔑 Shomer Secrets Rotated"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Date:*\n{timestamp}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Keys Rotated:*\n{keys_rotated}"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "⚠️ *Action Required:* Update production environment variables with rotated secrets from `.env.production`"
                }
            }
        ]
    }
    
    if dry_run:
        print(f"ℹ DRY RUN - would send to Slack:")
        print(f"  {message['text']}")
        print(f"  Keys: {keys_rotated}")
        return
    
    try:
        response = requests.post(webhook, json=message, timeout=10)
        response.raise_for_status()
        print(f"✓ Notification sent to Slack")
    except Exception as e:
        print(f"⚠ Failed to send Slack notification: {e}", file=sys.stderr)


def main():
    """Main entry point."""
    dry_run = os.getenv("DRY_RUN", "").lower() == "true"
    
    if dry_run:
        print("=" * 60)
        print("DRY RUN MODE - No changes will be made")
        print("=" * 60)
        print()
    
    # Rotate secrets
    rotated = rotate_secrets(dry_run=dry_run)
    
    # Notify Slack
    notify_slack(rotated, dry_run=dry_run)
    
    print()
    print("=" * 60)
    print("✅ Secret rotation complete")
    print("=" * 60)
    
    if not dry_run:
        print()
        print("⚠️  IMPORTANT: Update your production environment variables")
        print(f"   with the new values from {ENV_FILE}")
        print()
        print("   If using a secret manager (AWS Secrets Manager, etc.),")
        print("   update the secrets there and restart the application.")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

