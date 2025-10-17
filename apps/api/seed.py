#!/usr/bin/env python3
"""Database seeding script for development."""

import sys
from datetime import datetime

from sqlalchemy.exc import IntegrityError

from app.db.base import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def seed_database():
    """Seed database with initial data."""
    db = SessionLocal()
    
    try:
        print("🌱 Seeding database...")
        
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "admin@shomer.local").first()
        
        if existing_admin:
            print("✓ Admin user already exists")
            return
        
        # Create admin user
        admin = User(
            email="admin@shomer.local",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        
        db.add(admin)
        db.commit()
        
        print("✓ Created admin user:")
        print(f"  Email: admin@shomer.local")
        print(f"  Password: admin123")
        print(f"  Role: admin")
        
        # Create moderator user
        moderator = User(
            email="moderator@shomer.local",
            hashed_password=get_password_hash("mod123"),
            role="moderator",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        
        db.add(moderator)
        db.commit()
        
        print("✓ Created moderator user:")
        print(f"  Email: moderator@shomer.local")
        print(f"  Password: mod123")
        print(f"  Role: moderator")
        
        # Create regular user
        user = User(
            email="user@shomer.local",
            hashed_password=get_password_hash("user123"),
            role="user",
            is_active=True,
            created_at=datetime.utcnow(),
        )
        
        db.add(user)
        db.commit()
        
        print("✓ Created regular user:")
        print(f"  Email: user@shomer.local")
        print(f"  Password: user123")
        print(f"  Role: user")
        
        print("\n✅ Database seeding completed successfully!")
        
    except IntegrityError as e:
        print(f"⚠️  Database already seeded: {e}")
        db.rollback()
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
