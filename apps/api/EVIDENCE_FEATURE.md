# Evidence Submission & Chain-of-Custody Feature

## Overview

The Evidence Submission feature provides secure, cryptographically-verified evidence handling with complete chain-of-custody tracking. This feature is **FEATURE-FLAGGED** and disabled by default.

## Status: ✅ Implemented (Core Features) / 🚧 Stub (PDF Export)

### ✅ Implemented Features

- ✅ Database models for evidence, chain-of-custody, and access logs
- ✅ Cryptographic hashing (SHA-256 + MD5) on upload
- ✅ Immutable chain-of-custody audit trail
- ✅ Evidence verification (hash matching)
- ✅ Legal hold/seal functionality
- ✅ Access logging
- ✅ REST API endpoints with RBAC
- ✅ Frontend upload UI (feature-flagged)
- ✅ Frontend evidence list (stub)
- ✅ Database migration (005)

### 🚧 Stub Features (To Be Implemented)

- 🚧 PDF export of chain-of-custody
- 🚧 Digital signatures
- 🚧 QR code verification
- 🚧 Email notifications for evidence events
- 🚧 Advanced search and filtering
- 🚧 Bulk evidence operations

---

## Enabling the Feature

### Backend (API)

Set the feature flag in your environment:

```bash
# .env or environment variables
FEATURE_EVIDENCE=true
```

Restart the API server. The evidence endpoints will now be available at `/api/v1/evidence/*`.

### Frontend (Web)

Set the feature flag in your environment:

```bash
# .env.local or environment variables
NEXT_PUBLIC_FEATURE_EVIDENCE=true
```

The "Evidence" navigation item will appear in the dashboard sidebar.

---

## Database Setup

Run the migration to create evidence tables:

```bash
cd apps/api
alembic upgrade head  # Applies migration 005_add_evidence_tables.py
```

### Tables Created

1. **`evidence`** - Main evidence records with file hashes and metadata
2. **`chain_of_custody`** - Immutable audit log of all evidence actions
3. **`evidence_access_log`** - Detailed access tracking for viewing/downloading

---

## API Endpoints

### Upload Evidence

```http
POST /api/v1/evidence/upload
Content-Type: multipart/form-data

Fields:
- file: (binary) - Evidence file
- evidence_type: string - "photo", "video", "audio", "document", "other"
- description: string (optional) - Description
- location: string (optional) - Location where evidence was found
- tags: string (optional) - Comma-separated tags
- incident_id: int (optional) - Link to incident
- tip_id: int (optional) - Link to tip

Response 201:
{
  "id": 1,
  "reference_number": "EV-20250114120000-0001",
  "filename": "photo.jpg",
  "file_size": 1048576,
  "sha256_hash": "abc123...",
  "status": "pending",
  "received_at": "2025-01-14T12:00:00Z",
  "message": "Evidence uploaded successfully"
}
```

**Permissions:** EVIDENCE_SUBMIT (moderator+)

**Process:**
1. File uploaded to server
2. SHA-256 and MD5 hashes calculated
3. File saved to secure storage
4. Evidence record created with unique reference number
5. Chain-of-custody initialized with SUBMITTED and RECEIVED entries

---

### List Evidence

```http
GET /api/v1/evidence?incident_id=1&status=verified&page=1&page_size=50

Response 200:
{
  "items": [
    {
      "id": 1,
      "reference_number": "EV-20250114120000-0001",
      "evidence_type": "photo",
      "status": "verified",
      "filename": "photo.jpg",
      "sha256_hash": "abc123...",
      "submitted_at": "2025-01-14T12:00:00Z",
      "received_at": "2025-01-14T12:00:01Z",
      "custody_events_count": 5,
      "access_log_count": 2
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 50,
  "pages": 1
}
```

**Permissions:** EVIDENCE_VIEW (moderator+)

**Query Parameters:**
- `incident_id` - Filter by incident
- `tip_id` - Filter by tip
- `status` - Filter by status (pending, verified, sealed, archived, destroyed)
- `page` - Page number (default: 1)
- `page_size` - Results per page (default: 50, max: 100)

---

### Get Evidence Details

```http
GET /api/v1/evidence/{evidence_id}

Response 200:
{
  "id": 1,
  "reference_number": "EV-20250114120000-0001",
  "evidence_type": "photo",
  "status": "verified",
  "filename": "photo.jpg",
  "file_size": 1048576,
  "mime_type": "image/jpeg",
  "sha256_hash": "abc123...",
  "description": "Security camera footage",
  "location": "Building A, Floor 2",
  "tags": ["camera", "entrance"],
  "submitted_at": "2025-01-14T12:00:00Z",
  "received_at": "2025-01-14T12:00:01Z",
  "verified_at": "2025-01-14T12:05:00Z",
  "legal_hold": false,
  "custody_events_count": 5,
  "access_log_count": 2
}
```

**Permissions:** EVIDENCE_VIEW (moderator+)

**Note:** This access is logged in the chain-of-custody.

---

### Get Chain-of-Custody

```http
GET /api/v1/evidence/{evidence_id}/chain-of-custody

Response 200:
[
  {
    "id": 1,
    "evidence_id": 1,
    "action": "submitted",
    "action_by_user_id": 5,
    "action_by_name": "john@example.com",
    "action_by_user_email": "john@example.com",
    "timestamp": "2025-01-14T12:00:00Z",
    "description": "Evidence submitted: photo.jpg",
    "ip_address": "192.168.1.100",
    "hash_verified": null,
    "hash_match": null
  },
  {
    "id": 2,
    "evidence_id": 1,
    "action": "received",
    "action_by_name": "System",
    "timestamp": "2025-01-14T12:00:01Z",
    "description": "Evidence received by system",
    "hash_verified": true,
    "hash_match": true
  },
  {
    "id": 3,
    "evidence_id": 1,
    "action": "verified",
    "action_by_user_id": 3,
    "action_by_user_email": "admin@example.com",
    "timestamp": "2025-01-14T12:05:00Z",
    "description": "Integrity verification passed",
    "hash_verified": true,
    "hash_match": true
  }
]
```

**Permissions:** EVIDENCE_VIEW (moderator+)

**Chain-of-Custody Actions:**
- `submitted` - Initial submission by user
- `received` - Acknowledged by system
- `verified` - Hash integrity verified
- `accessed` - Viewed or downloaded
- `transferred` - Transferred to external party
- `sealed` - Sealed for legal proceedings
- `exported` - Chain-of-custody PDF generated
- `archived` - Moved to long-term storage
- `destroyed` - Securely deleted

---

### Verify Evidence Integrity

```http
POST /api/v1/evidence/{evidence_id}/verify

Response 200:
{
  "evidence_id": 1,
  "reference_number": "EV-20250114120000-0001",
  "hash_verified": true,
  "hash_match": true,
  "current_hash": "abc123...",
  "expected_hash": "abc123...",
  "verified_at": "2025-01-14T12:05:00Z",
  "message": "Hash verification passed"
}
```

**Permissions:** EVIDENCE_VERIFY (moderator+)

**Process:**
1. Read file from storage
2. Calculate SHA-256 hash
3. Compare with stored hash
4. Update evidence status if verified
5. Log verification in chain-of-custody

**Use Cases:**
- Verify file hasn't been tampered with
- Periodic integrity checks
- Pre-legal proceedings verification
- Audit compliance

---

### Seal Evidence (Legal Hold)

```http
POST /api/v1/evidence/{evidence_id}/seal

Request Body:
{
  "evidence_id": 1,
  "reason": "Criminal Investigation Case #2025-001",
  "case_number": "2025-001",
  "hold_until": "2026-01-14T00:00:00Z"  # Optional
}

Response 200:
{
  "evidence_id": 1,
  "reference_number": "EV-20250114120000-0001",
  "status": "sealed",
  "legal_hold": true,
  "sealed_at": "2025-01-14T14:00:00Z",
  "message": "Evidence sealed successfully"
}
```

**Permissions:** EVIDENCE_SEAL (admin only)

**Effects:**
- Status changes to SEALED
- Legal hold flag set to true
- Auto-deletion disabled
- Cannot be modified or deleted
- All access strictly logged

**Use Cases:**
- Criminal proceedings
- Civil litigation
- Internal investigations
- Regulatory compliance

---

### Export Chain-of-Custody PDF (STUB)

```http
GET /api/v1/evidence/{evidence_id}/export-chain-of-custody

Response 501:
{
  "detail": "PDF export is not yet implemented. This is a stub endpoint."
}
```

**Permissions:** EVIDENCE_EXPORT (moderator+)

**Planned Implementation:**
- Generate professional PDF document
- Include evidence details, full chain-of-custody, hashes
- Add QR code for online verification
- Digital signature placeholder
- Downloadable and printable

---

## Frontend Usage

### Submit Evidence

1. Navigate to **Dashboard** → **Evidence** (if feature enabled)
2. Click **"Submit Evidence"** button
3. Fill out the form:
   - Upload file (max 100MB)
   - Select evidence type
   - Add description (optional)
   - Add location (optional)
   - Add tags (optional)
   - Link to incident or tip (optional)
4. Click **"Submit Evidence"**
5. Receive reference number and file hash
6. Save reference number for future reference

### View Evidence List

1. Navigate to **Dashboard** → **Evidence** → **List**
2. View all submitted evidence
3. Search, filter, and sort (stub - to be implemented)
4. Click on evidence to view details
5. Export chain-of-custody PDF (stub - to be implemented)

---

## Security Features

### Cryptographic Integrity

- **SHA-256 hash** calculated on upload
- **MD5 hash** also calculated for additional verification
- Hashes stored immutably
- Verification endpoint recalculates hash and compares

### Chain-of-Custody

- **Immutable audit log** of all actions
- Each entry includes:
  - Timestamp (UTC)
  - Action performed
  - User who performed it
  - IP address
  - User agent
  - Hash verification status
  - Notes/description
- Cannot be modified or deleted

### Access Control (RBAC)

| Permission | Role | Description |
|------------|------|-------------|
| EVIDENCE_SUBMIT | Moderator+ | Upload evidence |
| EVIDENCE_VIEW | Moderator+ | View evidence and chain-of-custody |
| EVIDENCE_VERIFY | Moderator+ | Verify file integrity |
| EVIDENCE_SEAL | Admin only | Seal evidence for legal proceedings |
| EVIDENCE_EXPORT | Moderator+ | Export chain-of-custody PDF |
| EVIDENCE_DELETE | Admin only | Delete evidence (respects legal hold) |

### Storage Security

- Files stored in secure directory with restricted permissions
- Filenames include reference number (no original filename exposed)
- EXIF data removal (for photos) - to be implemented
- Encrypted storage (when using S3 with encryption)

---

## Data Retention

### Default Retention

| Data Type | Retention Period | Notes |
|-----------|------------------|-------|
| Evidence files | 1 year | Configurable |
| Chain-of-custody logs | 7 years | Legal requirement |
| Access logs | 1 year | Audit compliance |

### Legal Hold

- When evidence is sealed, retention periods are ignored
- Evidence cannot be auto-deleted
- Must be manually unsealed by admin

### Manual Deletion

- Admin can delete unsealed evidence
- Deletion logged in chain-of-custody
- Files securely overwritten (3 passes)

---

## Development

### Running Tests

```bash
cd apps/api
pytest tests/test_evidence.py  # To be created
```

### Extending the Feature

1. **Add new evidence types:**
   - Update `EvidenceType` enum in `models/evidence.py`
   - Update frontend dropdown in `evidence/page.tsx`

2. **Add new chain-of-custody actions:**
   - Update `ChainOfCustodyAction` enum in `models/evidence.py`
   - Update service methods as needed

3. **Implement PDF export:**
   - Install ReportLab: `pip install reportlab qrcode`
   - Complete `_generate_pdf_document()` in `services/chain_of_custody_pdf.py`
   - Update endpoint to return PDF file

4. **Add email notifications:**
   - Hook into evidence events
   - Send notifications for:
     - Evidence uploaded
     - Evidence verified
     - Evidence sealed
     - Access by other users

---

## Troubleshooting

### Feature Not Appearing

**Problem:** Evidence link not showing in dashboard

**Solution:**
1. Check `NEXT_PUBLIC_FEATURE_EVIDENCE=true` in `.env.local`
2. Restart Next.js dev server
3. Clear browser cache

---

### Upload Fails with 403

**Problem:** "Evidence submission feature is not enabled"

**Solution:**
1. Check `FEATURE_EVIDENCE=true` in backend `.env`
2. Restart API server
3. Verify environment variable is loaded: Check `/health` or logs

---

### Hash Mismatch Error

**Problem:** Verification shows hash mismatch

**Possible Causes:**
1. File was modified after upload
2. Storage corruption
3. Incorrect file path

**Solution:**
1. Check file exists at `file_path`
2. Compare file size with `file_size` in database
3. Review chain-of-custody for suspicious access
4. Escalate to admin for investigation

---

### Permission Denied

**Problem:** "Permission denied: evidence:submit"

**Solution:**
1. Verify user role is `moderator` or `admin`
2. Check RBAC configuration in `core/rbac.py`
3. Ensure permission is in role mapping
4. Re-authenticate if token expired

---

## Roadmap

### Phase 2 (Future)

- [ ] PDF export implementation with ReportLab
- [ ] Digital signatures for chain-of-custody
- [ ] QR code verification system
- [ ] EXIF data removal for photos
- [ ] Video thumbnail generation
- [ ] Bulk evidence upload
- [ ] Advanced search and filtering
- [ ] Evidence comparison/deduplication

### Phase 3 (Future)

- [ ] Encrypted storage at rest
- [ ] Multi-factor authentication for sealed evidence access
- [ ] Blockchain-based tamper-proof chain-of-custody
- [ ] AI-powered evidence categorization
- [ ] Integration with external forensic tools
- [ ] Mobile app for evidence submission

---

## References

- **Database Models:** `apps/api/app/models/evidence.py`
- **API Endpoints:** `apps/api/app/api/v1/endpoints/evidence.py`
- **Service Layer:** `apps/api/app/services/evidence_service.py`
- **Frontend UI:** `apps/web/src/app/dashboard/evidence/`
- **Migration:** `apps/api/alembic/versions/005_add_evidence_tables.py`
- **RBAC Config:** `apps/api/app/core/rbac.py`

---

## Support

For questions or issues:
- **Backend:** Review API logs in `apps/api/logs/`
- **Frontend:** Check browser console for errors
- **Database:** Review migration status: `alembic current`
- **Feature Flag:** Verify environment variables are set

---

**Feature Status:** ✅ Core Implemented | 🚧 PDF Export Stub | 🔒 Production Ready (after PDF implementation)

