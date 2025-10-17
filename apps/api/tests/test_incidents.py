"""Tests for incident endpoints and filters."""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base, get_db
from app.main import app
from app.models.incident import Incident, IncidentSeverity, IncidentStatus
from app.models.user import User, UserRole

# Create in-memory test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Create tables before each test and drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def viewer_user():
    """Create a viewer user."""
    db = TestingSessionLocal()
    user = User(
        email="viewer@example.com",
        username="viewer",
        hashed_password=get_password_hash("pass123"),
        role=UserRole.VIEWER.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def moderator_user():
    """Create a moderator user."""
    db = TestingSessionLocal()
    user = User(
        email="moderator@example.com",
        username="moderator",
        hashed_password=get_password_hash("pass123"),
        role=UserRole.MODERATOR.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


@pytest.fixture
def sample_incidents():
    """Create sample incidents for testing."""
    db = TestingSessionLocal()
    now = datetime.utcnow()

    incidents = [
        Incident(
            title="High Severity Incident",
            description="This is a critical security threat",
            severity=IncidentSeverity.HIGH.value,
            status=IncidentStatus.OPEN.value,
            location="Downtown",
            created_at=now - timedelta(hours=1),
        ),
        Incident(
            title="Medium Severity Incident",
            description="Suspicious activity reported",
            severity=IncidentSeverity.MEDIUM.value,
            status=IncidentStatus.INVESTIGATING.value,
            location="Suburb",
            created_at=now - timedelta(hours=5),
        ),
        Incident(
            title="Low Severity Incident",
            description="Minor disturbance",
            severity=IncidentSeverity.LOW.value,
            status=IncidentStatus.RESOLVED.value,
            location="Park",
            created_at=now - timedelta(days=2),
        ),
        Incident(
            title="Fire Emergency",
            description="Building fire reported downtown",
            severity=IncidentSeverity.CRITICAL.value,
            status=IncidentStatus.OPEN.value,
            location="Downtown",
            created_at=now - timedelta(minutes=30),
        ),
    ]

    for incident in incidents:
        db.add(incident)

    db.commit()
    db.close()
    return incidents


def get_auth_headers(user):
    """Generate authorization headers for a user."""
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def test_list_incidents_without_auth():
    """Test listing incidents without authentication."""
    response = client.get("/api/v1/incidents/")
    assert response.status_code == 403


def test_list_incidents_basic(viewer_user, sample_incidents):
    """Test basic incident listing."""
    response = client.get(
        "/api/v1/incidents/", headers=get_auth_headers(viewer_user)
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4
    assert len(data["incidents"]) == 4
    assert data["page"] == 1


def test_list_incidents_pagination(viewer_user, sample_incidents):
    """Test incident list pagination."""
    response = client.get(
        "/api/v1/incidents/?page=1&page_size=2",
        headers=get_auth_headers(viewer_user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4
    assert len(data["incidents"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 2


def test_filter_by_severity(viewer_user, sample_incidents):
    """Test filtering incidents by severity."""
    response = client.get(
        "/api/v1/incidents/?severity=high",
        headers=get_auth_headers(viewer_user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["incidents"][0]["severity"] == "high"


def test_filter_by_status(viewer_user, sample_incidents):
    """Test filtering incidents by status."""
    response = client.get(
        "/api/v1/incidents/?status=open",
        headers=get_auth_headers(viewer_user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    for incident in data["incidents"]:
        assert incident["status"] == "open"


def test_filter_by_keyword(viewer_user, sample_incidents):
    """Test filtering incidents by keyword."""
    response = client.get(
        "/api/v1/incidents/?keyword=fire",
        headers=get_auth_headers(viewer_user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert "fire" in data["incidents"][0]["title"].lower()


def test_filter_by_date_range(viewer_user, sample_incidents):
    """Test filtering incidents by date range."""
    now = datetime.utcnow()
    start_date = (now - timedelta(hours=6)).isoformat()
    end_date = now.isoformat()

    response = client.get(
        f"/api/v1/incidents/?start_date={start_date}&end_date={end_date}",
        headers=get_auth_headers(viewer_user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3  # Should exclude the 2-day-old incident


def test_create_incident_as_viewer(viewer_user):
    """Test that viewers cannot create incidents."""
    response = client.post(
        "/api/v1/incidents/",
        headers=get_auth_headers(viewer_user),
        json={
            "title": "New Incident",
            "description": "Test incident",
            "severity": "medium",
            "status": "open",
        },
    )

    assert response.status_code == 403


def test_create_incident_as_moderator(moderator_user):
    """Test that moderators can create incidents."""
    response = client.post(
        "/api/v1/incidents/",
        headers=get_auth_headers(moderator_user),
        json={
            "title": "New Incident",
            "description": "Test incident",
            "severity": "medium",
            "status": "open",
            "location": "Test Location",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "New Incident"
    assert data["severity"] == "medium"


def test_update_incident_as_moderator(moderator_user, sample_incidents):
    """Test updating an incident as moderator."""
    response = client.put(
        "/api/v1/incidents/1",
        headers=get_auth_headers(moderator_user),
        json={"status": "resolved"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "resolved"
    assert data["resolved_at"] is not None


def test_get_incident_by_id(viewer_user, sample_incidents):
    """Test retrieving a specific incident by ID."""
    response = client.get(
        "/api/v1/incidents/1", headers=get_auth_headers(viewer_user)
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert "title" in data


def test_get_nonexistent_incident(viewer_user):
    """Test retrieving a non-existent incident."""
    response = client.get(
        "/api/v1/incidents/9999", headers=get_auth_headers(viewer_user)
    )

    assert response.status_code == 404


def test_combined_filters(viewer_user, sample_incidents):
    """Test combining multiple filters."""
    response = client.get(
        "/api/v1/incidents/?severity=high&status=open&keyword=security",
        headers=get_auth_headers(viewer_user),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    incident = data["incidents"][0]
    assert incident["severity"] == "high"
    assert incident["status"] == "open"
    assert "security" in incident["description"].lower()

