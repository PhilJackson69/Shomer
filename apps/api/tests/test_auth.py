"""Tests for authentication endpoints."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import get_password_hash
from app.db.base import Base, get_db
from app.main import app
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
def test_user():
    """Create a test user."""
    db = TestingSessionLocal()
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpass123"),
        full_name="Test User",
        role=UserRole.VIEWER.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def test_register_new_user():
    """Test user registration."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "newpass123",
            "full_name": "New User",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["username"] == "newuser"
    assert data["user"]["role"] == "viewer"
    assert "access_token" in data


def test_register_duplicate_email():
    """Test registration with duplicate email."""
    # First registration
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "username": "user1",
            "password": "pass123",
        },
    )

    # Second registration with same email
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "duplicate@example.com",
            "username": "user2",
            "password": "pass123",
        },
    )

    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]


def test_register_duplicate_username():
    """Test registration with duplicate username."""
    # First registration
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "user1@example.com",
            "username": "duplicate",
            "password": "pass123",
        },
    )

    # Second registration with same username
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "user2@example.com",
            "username": "duplicate",
            "password": "pass123",
        },
    )

    assert response.status_code == 400
    assert "Username already taken" in response.json()["detail"]


def test_login_success(test_user):
    """Test successful login."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpass123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(test_user):
    """Test login with wrong password."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "wrongpassword"},
    )

    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


def test_login_nonexistent_user():
    """Test login with non-existent user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent", "password": "password"},
    )

    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


def test_login_inactive_user():
    """Test login with inactive user."""
    db = TestingSessionLocal()
    user = User(
        email="inactive@example.com",
        username="inactive",
        hashed_password=get_password_hash("pass123"),
        role=UserRole.VIEWER.value,
        is_active=False,
    )
    db.add(user)
    db.commit()
    db.close()

    response = client.post(
        "/api/v1/auth/login",
        json={"username": "inactive", "password": "pass123"},
    )

    assert response.status_code == 400
    assert "Inactive user" in response.json()["detail"]


def test_protected_endpoint_without_token():
    """Test accessing protected endpoint without token."""
    response = client.get("/api/v1/users/me")

    assert response.status_code == 403


def test_protected_endpoint_with_invalid_token():
    """Test accessing protected endpoint with invalid token."""
    response = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer invalid_token"}
    )

    assert response.status_code == 401

