"""
Tests for evidence submission and chain-of-custody endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from io import BytesIO
from app.main import app
from app.core.config import settings

client = TestClient(app)


@pytest.fixture
def auth_headers(test_user_token):
    """Get authentication headers for testing."""
    return {"Authorization": f"Bearer {test_user_token}"}


@pytest.fixture
def admin_headers(test_admin_token):
    """Get admin authentication headers for testing."""
    return {"Authorization": f"Bearer {test_admin_token}"}


def test_evidence_feature_flag():
    """Test that evidence endpoints respect the feature flag."""
    # If feature is disabled, should get 403
    if not settings.FEATURE_EVIDENCE:
        response = client.get("/api/v1/evidence")
        assert response.status_code == 403
        assert "not enabled" in response.json()["detail"].lower()


def test_upload_evidence(auth_headers):
    """Test uploading evidence file."""
    # Create a test file
    test_file = BytesIO(b"This is test evidence content")
    test_file.name = "test_evidence.txt"
    
    files = {
        "file": ("test_evidence.txt", test_file, "text/plain")
    }
    data = {
        "evidence_type": "document",
        "description": "Test evidence submission",
        "location": "Test location",
        "tags": "test,evidence",
    }
    
    response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=auth_headers
    )
    
    assert response.status_code == 201
    result = response.json()
    
    # Verify response structure
    assert "id" in result
    assert "reference_number" in result
    assert "sha256_hash" in result
    assert result["filename"] == "test_evidence.txt"
    assert result["status"] == "pending"
    
    return result


def test_upload_duplicate_evidence(auth_headers):
    """Test that duplicate evidence (same hash) is rejected."""
    # Upload first file
    test_file = BytesIO(b"Unique content for duplicate test")
    files = {
        "file": ("test1.txt", test_file, "text/plain")
    }
    data = {
        "evidence_type": "document",
        "description": "First upload",
    }
    
    response1 = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=auth_headers
    )
    assert response1.status_code == 201
    
    # Try to upload same file again (same hash)
    test_file2 = BytesIO(b"Unique content for duplicate test")
    files2 = {
        "file": ("test2.txt", test_file2, "text/plain")
    }
    data2 = {
        "evidence_type": "document",
        "description": "Duplicate upload",
    }
    
    response2 = client.post(
        "/api/v1/evidence/upload",
        files=files2,
        data=data2,
        headers=auth_headers
    )
    assert response2.status_code == 409  # Conflict
    assert "already exists" in response2.json()["detail"].lower()


def test_list_evidence(auth_headers):
    """Test listing evidence with pagination."""
    response = client.get(
        "/api/v1/evidence?page=1&page_size=10",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    result = response.json()
    
    # Verify response structure
    assert "items" in result
    assert "total" in result
    assert "page" in result
    assert "page_size" in result
    assert "pages" in result
    assert isinstance(result["items"], list)


def test_get_evidence_by_id(auth_headers):
    """Test getting specific evidence by ID."""
    # First upload evidence
    test_file = BytesIO(b"Test content for get by id")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document", "description": "Test"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=auth_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Get evidence by ID
    response = client.get(
        f"/api/v1/evidence/{evidence_id}",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    result = response.json()
    assert result["id"] == evidence_id


def test_get_chain_of_custody(auth_headers):
    """Test getting chain-of-custody for evidence."""
    # Upload evidence first
    test_file = BytesIO(b"Test content for custody chain")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=auth_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Get chain of custody
    response = client.get(
        f"/api/v1/evidence/{evidence_id}/chain-of-custody",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    custody_chain = response.json()
    assert isinstance(custody_chain, list)
    assert len(custody_chain) >= 2  # Should have SUBMITTED and RECEIVED entries
    
    # Verify first entry is SUBMITTED
    assert custody_chain[0]["action"] == "submitted"
    # Verify second entry is RECEIVED
    assert custody_chain[1]["action"] == "received"


def test_verify_evidence(auth_headers):
    """Test verifying evidence integrity."""
    # Upload evidence first
    test_file = BytesIO(b"Test content for verification")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=auth_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Verify evidence
    response = client.post(
        f"/api/v1/evidence/{evidence_id}/verify",
        headers=auth_headers
    )
    
    assert response.status_code == 200
    result = response.json()
    
    assert result["hash_verified"] is True
    assert result["hash_match"] is True
    assert "current_hash" in result
    assert "expected_hash" in result


def test_seal_evidence(admin_headers):
    """Test sealing evidence (admin only)."""
    # Upload evidence first
    test_file = BytesIO(b"Test content for sealing")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=admin_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Seal evidence
    seal_data = {
        "evidence_id": evidence_id,
        "reason": "Legal proceedings - Case #12345",
        "case_number": "12345",
    }
    
    response = client.post(
        f"/api/v1/evidence/{evidence_id}/seal",
        json=seal_data,
        headers=admin_headers
    )
    
    assert response.status_code == 200
    result = response.json()
    
    assert result["status"] == "sealed"
    assert result["legal_hold"] is True
    assert "sealed_at" in result


def test_seal_evidence_twice_fails(admin_headers):
    """Test that sealing already sealed evidence fails."""
    # Upload and seal evidence
    test_file = BytesIO(b"Test content for double seal")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=admin_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # First seal
    seal_data = {
        "evidence_id": evidence_id,
        "reason": "Test seal",
    }
    client.post(
        f"/api/v1/evidence/{evidence_id}/seal",
        json=seal_data,
        headers=admin_headers
    )
    
    # Try to seal again
    response = client.post(
        f"/api/v1/evidence/{evidence_id}/seal",
        json=seal_data,
        headers=admin_headers
    )
    
    assert response.status_code == 400
    assert "already sealed" in response.json()["detail"].lower()


def test_export_chain_of_custody_pdf(admin_headers):
    """Test exporting chain-of-custody as PDF."""
    # Upload evidence first
    test_file = BytesIO(b"Test content for PDF export")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=admin_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Export PDF
    response = client.get(
        f"/api/v1/evidence/{evidence_id}/export-chain-of-custody?purpose=Testing",
        headers=admin_headers
    )
    
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    
    # Verify PDF content starts with PDF magic bytes
    assert response.content[:4] == b"%PDF"


def test_export_pdf_logs_custody_event(admin_headers):
    """Test that PDF export creates a custody log entry."""
    # Upload evidence
    test_file = BytesIO(b"Test content for PDF export logging")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=admin_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Get initial custody chain length
    custody_before = client.get(
        f"/api/v1/evidence/{evidence_id}/chain-of-custody",
        headers=admin_headers
    ).json()
    
    # Export PDF
    client.get(
        f"/api/v1/evidence/{evidence_id}/export-chain-of-custody?purpose=Testing",
        headers=admin_headers
    )
    
    # Get updated custody chain
    custody_after = client.get(
        f"/api/v1/evidence/{evidence_id}/chain-of-custody",
        headers=admin_headers
    ).json()
    
    # Verify new entry was added
    assert len(custody_after) == len(custody_before) + 1
    
    # Verify last entry is EXPORTED
    last_entry = custody_after[-1]
    assert last_entry["action"] == "exported"
    assert "PDF exported" in last_entry["description"]


def test_evidence_permissions(test_user_token):
    """Test that non-admin users cannot seal evidence."""
    user_headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Upload evidence
    test_file = BytesIO(b"Test content")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {"evidence_type": "document"}
    
    upload_response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
        headers=user_headers
    )
    evidence_id = upload_response.json()["id"]
    
    # Try to seal as regular user (should fail)
    seal_data = {
        "evidence_id": evidence_id,
        "reason": "Unauthorized seal attempt",
    }
    
    response = client.post(
        f"/api/v1/evidence/{evidence_id}/seal",
        json=seal_data,
        headers=user_headers
    )
    
    assert response.status_code == 403


def test_invalid_evidence_type():
    """Test that invalid evidence type is rejected."""
    test_file = BytesIO(b"Test content")
    files = {"file": ("test.txt", test_file, "text/plain")}
    data = {
        "evidence_type": "invalid_type",
        "description": "Test",
    }
    
    response = client.post(
        "/api/v1/evidence/upload",
        files=files,
        data=data,
    )
    
    assert response.status_code == 400


def test_evidence_not_found(auth_headers):
    """Test that requesting non-existent evidence returns 404."""
    response = client.get(
        "/api/v1/evidence/99999",
        headers=auth_headers
    )
    assert response.status_code == 404

