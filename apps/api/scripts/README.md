# Shomer API Scripts

This directory contains operational scripts for managing and testing the Shomer API.

## Backup & Restore

### `backup-restore-drill.sh`

Comprehensive backup and restore drill script.

**Usage:**
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/shomer"
export TOKEN="your-jwt-token"
export API="http://localhost:8000"

./backup-restore-drill.sh ./backup-$(date +%Y%m%d)
```

**What it does:**
1. Backs up PostgreSQL database using `pg_dump`
2. Backs up local storage (evidence files)
3. Verifies backup integrity
4. Samples evidence hashes for verification
5. Provides restore instructions
6. Generates detailed report

**Requirements:**
- `pg_dump` (PostgreSQL client tools)
- `jq` (JSON processor)
- `curl`

**Output:**
- `backup-YYYYMMDD/db/dump.sql` - Database dump
- `backup-YYYYMMDD/storage/` - Evidence files
- `backup-YYYYMMDD/evidence_hashes.csv` - Hash samples
- `backup-YYYYMMDD/restore_report.txt` - Summary report

## Testing

### Evidence Hash Verification

See `../tests/verify-hash-test.sh` for evidence integrity testing.

### Load Testing

See `../tests/k6/evidence-load-test.js` for k6 load tests.

## Production Operations

### Pre-Deployment Checklist

1. **Backup current state:**
   ```bash
   ./backup-restore-drill.sh ./pre-deploy-backup
   ```

2. **Run database migrations:**
   ```bash
   cd ../apps/api
   alembic upgrade head
   ```

3. **Verify health:**
   ```bash
   curl http://localhost:8000/health
   ```

4. **Test evidence upload:**
   ```bash
   export TOKEN="admin-token"
   ../tests/verify-hash-test.sh
   ```

### Post-Incident Recovery

If evidence integrity is compromised:

1. **Stop all writes:**
   - Set API to read-only mode
   - Block all upload endpoints

2. **Verify current state:**
   ```bash
   # Check evidence integrity
   psql $DATABASE_URL -c "SELECT id, reference_number, sha256_hash FROM evidence WHERE verified_at IS NULL;"
   ```

3. **Restore from backup:**
   ```bash
   # Restore database
   psql $DATABASE_URL < backup/db/dump.sql
   
   # Restore storage
   rsync -av backup/storage/ uploads/
   ```

4. **Verify restore:**
   ```bash
   # Re-verify all evidence
   curl -X POST "$API/api/v1/evidence/verify-all" \
     -H "Authorization: Bearer $TOKEN"
   ```

## Monitoring

### Database Size Monitoring

```bash
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('shomer'));"
```

### Evidence Storage Usage

```bash
du -sh uploads/evidence/
```

### Chain of Custody Audit

```bash
psql $DATABASE_URL -c "
  SELECT 
    DATE(timestamp) as date,
    COUNT(*) as events,
    COUNT(DISTINCT evidence_id) as evidence_count
  FROM chain_of_custody
  GROUP BY DATE(timestamp)
  ORDER BY date DESC
  LIMIT 7;
"
```

## Automation

These scripts can be integrated into cron jobs or CI/CD pipelines:

**Daily backup (crontab):**
```cron
0 2 * * * /path/to/backup-restore-drill.sh /backups/daily-$(date +\%Y\%m\%d)
```

**Weekly restore drill:**
```cron
0 3 * * 0 /path/to/backup-restore-drill.sh /backups/weekly-$(date +\%Y\%m\%d) && verify-restore.sh
```

## Support

For issues or questions, see the main README or contact the development team.

