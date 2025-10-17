#!/usr/bin/env python3
"""Demo data seeding script for Shomer platform demonstration."""

import sys
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy.exc import IntegrityError

from app.core.security import get_password_hash
from app.db.base import SessionLocal
from app.models.alert import Alert, AlertStatus
from app.models.audit_log import AuditLog
from app.models.event import Event
from app.models.incident import Incident
from app.models.tip import Tip
from app.models.user import User


def create_demo_users(db):
    """Create demo users if they don't exist."""
    print("👥 Creating demo users...")
    
    users = [
        {
            "email": "admin@shomer.local",
            "password": "admin123",
            "role": "admin",
        },
        {
            "email": "moderator@shomer.local",
            "password": "mod123",
            "role": "moderator",
        },
        {
            "email": "user@shomer.local",
            "password": "user123",
            "role": "user",
        },
    ]
    
    created_users = {}
    for user_data in users:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if existing:
            created_users[user_data["role"]] = existing
            print(f"  ✓ User exists: {user_data['email']}")
        else:
            user = User(
                email=user_data["email"],
                hashed_password=get_password_hash(user_data["password"]),
                role=user_data["role"],
                is_active=True,
                created_at=datetime.utcnow(),
            )
            db.add(user)
            created_users[user_data["role"]] = user
            print(f"  ✓ Created user: {user_data['email']}")
    
    db.commit()
    return created_users


def create_demo_incidents(db, users):
    """Create 8 sample incidents with varied severities."""
    print("\n🚨 Creating sample incidents...")
    
    incidents_data = [
        {
            "title": "Suspicious Activity Near Community Center",
            "description": "Multiple individuals observed loitering near the community center entrance after hours. Appeared to be taking photos of security cameras and exit points.",
            "severity": "high",
            "status": "investigating",
            "location": "123 Community Center Dr",
            "source_url": "https://example.com/report/1",
            "risk_score": 85,
            "created_at": datetime.utcnow() - timedelta(hours=2),
        },
        {
            "title": "Graffiti with Threatening Message",
            "description": "Hateful graffiti discovered on the east wall of the synagogue. Message contains violent threats and antisemitic symbols.",
            "severity": "critical",
            "status": "new",
            "location": "456 Temple Ave",
            "source_url": "https://example.com/report/2",
            "risk_score": 95,
            "created_at": datetime.utcnow() - timedelta(hours=5),
        },
        {
            "title": "Unattended Package Reported",
            "description": "Community member reported an unattended backpack left near the main entrance. Package has been there for over 30 minutes.",
            "severity": "high",
            "status": "investigating",
            "location": "789 Main St",
            "risk_score": 78,
            "created_at": datetime.utcnow() - timedelta(hours=1),
        },
        {
            "title": "Online Harassment Campaign",
            "description": "Social media accounts targeting community members with coordinated harassment. Multiple fake profiles sharing private information.",
            "severity": "medium",
            "status": "investigating",
            "location": "Online",
            "source_url": "https://twitter.com/example",
            "risk_score": 65,
            "created_at": datetime.utcnow() - timedelta(days=1),
        },
        {
            "title": "Parking Lot Security Camera Vandalism",
            "description": "Two security cameras in the parking lot were spray-painted overnight. Footage shows unknown suspects wearing masks.",
            "severity": "medium",
            "status": "resolved",
            "location": "321 Parking Area",
            "risk_score": 55,
            "created_at": datetime.utcnow() - timedelta(days=3),
        },
        {
            "title": "Suspicious Vehicle Circling Neighborhood",
            "description": "Dark sedan with tinted windows observed driving slowly through the neighborhood multiple times. License plate partially obscured.",
            "severity": "medium",
            "status": "monitoring",
            "location": "Residential Area, Block 5",
            "risk_score": 60,
            "created_at": datetime.utcnow() - timedelta(hours=8),
        },
        {
            "title": "Attempted Break-in at Community Storage",
            "description": "Failed break-in attempt at community storage facility. Lock was damaged but entry was not gained. Police report filed.",
            "severity": "high",
            "status": "resolved",
            "location": "555 Storage Rd",
            "source_url": "https://example.com/police-report/123",
            "risk_score": 72,
            "created_at": datetime.utcnow() - timedelta(days=2),
        },
        {
            "title": "Threatening Phone Calls to Office",
            "description": "Office received three anonymous phone calls with vague threats. Caller ID blocked. Calls occurred between 2-3 PM.",
            "severity": "medium",
            "status": "new",
            "location": "999 Office Building",
            "risk_score": 68,
            "created_at": datetime.utcnow() - timedelta(hours=4),
        },
    ]
    
    created_incidents = []
    moderator = users.get("moderator")
    
    for data in incidents_data:
        incident = Incident(
            title=data["title"],
            description=data["description"],
            severity=data["severity"],
            status=data["status"],
            location=data.get("location"),
            source_url=data.get("source_url"),
            risk_score=data.get("risk_score", 50),
            created_at=data.get("created_at", datetime.utcnow()),
            created_by=moderator.id if moderator else None,
            metadata={
                "demo": True,
                "risk_factors": [
                    "Pattern recognition",
                    "Location sensitivity",
                    "Time of day",
                ],
            },
        )
        db.add(incident)
        created_incidents.append(incident)
        print(f"  ✓ Created incident: {data['title'][:50]}... ({data['severity']})")
    
    db.commit()
    return created_incidents


def create_demo_tips(db):
    """Create 3 tips with placeholder photo references."""
    print("\n💡 Creating sample tips...")
    
    tips_data = [
        {
            "content": "Saw someone taking photos of the security system at the main entrance around 11 PM last night. They were wearing a dark hoodie and left quickly when I approached.",
            "location": "Main Entrance",
            "submitter_email": "concerned.citizen@example.com",
            "status": "new",
            "metadata": {
                "demo": True,
                "photo_description": "Person in dark hoodie near entrance camera",
                "had_exif": True,
                "cleaned_hash": "abc123placeholder",
            },
        },
        {
            "content": "Found antisemitic flyers in the parking lot this morning. They appear to be mass-produced and professionally printed. I collected them and can provide them to authorities.",
            "location": "Parking Lot B",
            "submitter_phone": "+1-555-0123",
            "status": "escalated",
            "metadata": {
                "demo": True,
                "photo_description": "Hateful flyers found in parking area",
                "had_exif": False,
                "cleaned_hash": "def456placeholder",
            },
        },
        {
            "content": "Noticed the same unmarked white van parked across the street for the past three days. Driver appears to be watching the building. Have photos of license plate.",
            "location": "Across from 789 Main St",
            "submitter_email": "watchful@example.com",
            "status": "under_investigation",
            "metadata": {
                "demo": True,
                "photo_description": "White van with visible license plate",
                "had_exif": True,
                "cleaned_hash": "ghi789placeholder",
                "original_hash": "ghi789original",
                "legally_required": True,
            },
        },
    ]
    
    created_tips = []
    for data in tips_data:
        tip = Tip(
            content=data["content"],
            location=data.get("location"),
            submitter_email=data.get("submitter_email"),
            submitter_phone=data.get("submitter_phone"),
            status=data.get("status", "new"),
            created_at=datetime.utcnow() - timedelta(hours=len(created_tips) * 3),
            metadata=data.get("metadata", {}),
        )
        db.add(tip)
        created_tips.append(tip)
        print(f"  ✓ Created tip: {data['content'][:50]}... ({data['status']})")
    
    db.commit()
    return created_tips


def create_demo_event(db, users):
    """Create 1 event with example recommendations."""
    print("\n📅 Creating sample event...")
    
    admin = users.get("admin")
    
    event = Event(
        name="Annual Community Gathering",
        description="Large outdoor gathering expected to draw 500+ attendees. Includes food vendors, children's activities, and evening concert.",
        event_type="gathering",
        location="Central Park Pavilion",
        start_time=datetime.utcnow() + timedelta(days=14),
        end_time=datetime.utcnow() + timedelta(days=14, hours=6),
        expected_attendance=500,
        risk_level="medium",
        created_by=admin.id if admin else None,
        metadata={
            "demo": True,
            "venue_details": {
                "capacity": 750,
                "indoor_portion": False,
                "parking_spaces": 200,
                "accessible": True,
            },
            "recommendations": [
                {
                    "category": "Security Personnel",
                    "priority": "high",
                    "recommendation": "Deploy 8-10 security personnel throughout the event. Position at entrances, parking areas, and children's zones.",
                    "rationale": "Large attendance requires visible security presence to deter incidents and respond quickly.",
                },
                {
                    "category": "Access Control",
                    "priority": "high",
                    "recommendation": "Implement bag check stations at all entry points. Use metal detector wands for random screening.",
                    "rationale": "Outdoor events are vulnerable to weapons and prohibited items being brought in.",
                },
                {
                    "category": "Communication",
                    "priority": "medium",
                    "recommendation": "Establish radio communication network for security team. Designate emergency contact person.",
                    "rationale": "Rapid coordination essential for 500+ person event across outdoor area.",
                },
                {
                    "category": "Perimeter Security",
                    "priority": "medium",
                    "recommendation": "Use barrier fencing to define event perimeter. Limit entry/exit points to 2-3 controlled locations.",
                    "rationale": "Controlled access points improve security and crowd management.",
                },
                {
                    "category": "Medical Preparedness",
                    "priority": "high",
                    "recommendation": "Coordinate with local EMS. Have first aid station staffed throughout event. Keep evacuation routes clear.",
                    "rationale": "Large gathering requires medical readiness. Children's activities increase likelihood of minor injuries.",
                },
                {
                    "category": "Parking Security",
                    "priority": "low",
                    "recommendation": "Position security volunteer in parking area. Install temporary lighting if event extends to evening.",
                    "rationale": "Parking areas can be targets for theft and vandalism during events.",
                },
                {
                    "category": "Weather Monitoring",
                    "priority": "medium",
                    "recommendation": "Monitor weather forecasts closely. Have indoor backup plan ready. Announce shelter locations at event start.",
                    "rationale": "Outdoor events require weather contingency plans for attendee safety.",
                },
            ],
            "risk_score": 62,
            "risk_factors": [
                "Large attendance (500+)",
                "Outdoor venue",
                "Children present",
                "Evening component",
                "Multiple entry points",
            ],
        },
    )
    
    db.add(event)
    db.commit()
    
    print(f"  ✓ Created event: {event.name}")
    print(f"    - Risk Level: {event.risk_level}")
    print(f"    - Attendance: {event.expected_attendance}")
    print(f"    - Recommendations: {len(event.metadata.get('recommendations', []))}")
    
    return event


def create_demo_alerts(db, users, incidents):
    """Create sample alert records."""
    print("\n📧 Creating sample alert records...")
    
    moderator = users.get("moderator")
    
    alerts_data = [
        {
            "channel": "email",
            "recipient": "security-team@example.com",
            "subject": "URGENT: Critical Incident Reported",
            "message": "A critical severity incident has been reported. Immediate review required.",
            "status": AlertStatus.SENT.value,
            "sent_at": datetime.utcnow() - timedelta(hours=5),
            "metadata": {
                "demo": True,
                "incident_id": incidents[1].id if len(incidents) > 1 else None,
                "severity": "critical",
            },
        },
        {
            "channel": "sms",
            "recipient": "+1-555-0199",
            "message": "Shomer Alert: High priority incident requires attention. Check dashboard for details.",
            "status": AlertStatus.SENT.value,
            "sent_at": datetime.utcnow() - timedelta(hours=2),
            "metadata": {
                "demo": True,
                "incident_id": incidents[0].id if len(incidents) > 0 else None,
                "severity": "high",
            },
        },
        {
            "channel": "email",
            "recipient": "community-leaders@example.com",
            "subject": "Weekly Security Digest",
            "message": "Summary of this week's security incidents and ongoing investigations.",
            "status": AlertStatus.SENT.value,
            "sent_at": datetime.utcnow() - timedelta(days=1),
            "metadata": {
                "demo": True,
                "digest": True,
                "incidents_count": len(incidents),
            },
        },
    ]
    
    created_alerts = []
    for data in alerts_data:
        alert = Alert(
            channel=data["channel"],
            recipient=data["recipient"],
            subject=data.get("subject"),
            message=data["message"],
            status=data["status"],
            sent_at=data.get("sent_at"),
            created_by=moderator.id if moderator else None,
            metadata=data.get("metadata", {}),
            created_at=data.get("sent_at", datetime.utcnow()),
        )
        db.add(alert)
        created_alerts.append(alert)
        print(f"  ✓ Created alert: {data['channel']} to {data['recipient']}")
    
    db.commit()
    return created_alerts


def create_demo_audit_logs(db, users, incidents):
    """Create sample audit log entries."""
    print("\n📋 Creating sample audit logs...")
    
    moderator = users.get("moderator")
    admin = users.get("admin")
    
    logs_data = [
        {
            "action": "incident_created",
            "user_id": moderator.id if moderator else None,
            "resource_type": "incident",
            "resource_id": str(incidents[0].id) if incidents else "1",
            "details": {
                "title": "Suspicious Activity Near Community Center",
                "severity": "high",
                "status": "new",
            },
            "created_at": datetime.utcnow() - timedelta(hours=2, minutes=5),
        },
        {
            "action": "incident_updated",
            "user_id": moderator.id if moderator else None,
            "resource_type": "incident",
            "resource_id": str(incidents[0].id) if incidents else "1",
            "details": {
                "before": {"status": "new"},
                "after": {"status": "investigating"},
                "changes": {
                    "status": {"from": "new", "to": "investigating"}
                },
            },
            "created_at": datetime.utcnow() - timedelta(hours=2),
        },
        {
            "action": "alert_sent",
            "user_id": moderator.id if moderator else None,
            "resource_type": "alert",
            "resource_id": "1",
            "details": {
                "channel": "email",
                "recipient": "security-team@example.com",
                "incident_id": incidents[1].id if len(incidents) > 1 else None,
            },
            "created_at": datetime.utcnow() - timedelta(hours=5),
        },
        {
            "action": "user_login",
            "user_id": admin.id if admin else None,
            "resource_type": "auth",
            "resource_id": str(admin.id) if admin else "1",
            "details": {
                "ip_address": "192.168.1.100",
                "user_agent": "Mozilla/5.0 (Demo Browser)",
            },
            "created_at": datetime.utcnow() - timedelta(hours=1),
        },
        {
            "action": "tip_created",
            "user_id": None,  # Public submission
            "resource_type": "tip",
            "resource_id": "1",
            "details": {
                "has_image": True,
                "has_contact": True,
                "location": "Main Entrance",
            },
            "created_at": datetime.utcnow() - timedelta(hours=6),
        },
    ]
    
    created_logs = []
    for data in logs_data:
        log = AuditLog(
            action=data["action"],
            user_id=data.get("user_id"),
            resource_type=data["resource_type"],
            resource_id=data.get("resource_id"),
            details=data.get("details", {}),
            created_at=data.get("created_at", datetime.utcnow()),
        )
        db.add(log)
        created_logs.append(log)
        print(f"  ✓ Created audit log: {data['action']}")
    
    db.commit()
    return created_logs


def main():
    """Main demo seed function."""
    print("\n" + "=" * 60)
    print("🌱 SHOMER DEMO DATA SEEDING")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Create users
        users = create_demo_users(db)
        
        # Create incidents
        incidents = create_demo_incidents(db, users)
        
        # Create tips
        tips = create_demo_tips(db)
        
        # Create event
        event = create_demo_event(db, users)
        
        # Create alerts
        alerts = create_demo_alerts(db, users, incidents)
        
        # Create audit logs
        audit_logs = create_demo_audit_logs(db, users, incidents)
        
        print("\n" + "=" * 60)
        print("✅ DEMO DATA SEEDING COMPLETE!")
        print("=" * 60)
        print("\n📊 Summary:")
        print(f"  • Users: 3 (admin, moderator, user)")
        print(f"  • Incidents: {len(incidents)}")
        print(f"  • Tips: {len(tips)}")
        print(f"  • Events: 1")
        print(f"  • Alerts: {len(alerts)}")
        print(f"  • Audit Logs: {len(audit_logs)}")
        
        print("\n🔑 Demo Credentials:")
        print("  • Admin: admin@shomer.local / admin123")
        print("  • Moderator: moderator@shomer.local / mod123")
        print("  • User: user@shomer.local / user123")
        
        print("\n🌐 Access Points:")
        print("  • Web: http://localhost:3000")
        print("  • API: http://localhost:8000")
        print("  • Docs: http://localhost:8000/docs")
        
        print("\n📖 Next Steps:")
        print("  1. Login to the web interface")
        print("  2. Follow the demo guide in docs/DEMO.md")
        print("  3. Try triaging incidents, sending alerts, and reviewing audit logs")
        print("\n")
        
    except IntegrityError as e:
        print(f"\n⚠️  Some data already exists: {e}")
        print("This is normal if you've run the seed script before.")
        db.rollback()
    except Exception as e:
        print(f"\n❌ Error seeding demo data: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

